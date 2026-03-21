import { pool } from '../db/pool.js';
import * as orgSettings from '../models/organizationsSettingsModel.js';
import { logger } from '../utils/logger.js';

interface NomenclatureItem {
  id?: string;
  name?: string;
  code?: string;
  type?: string;
}

interface IikoNomenclatureResponse {
  products?: NomenclatureItem[];
  items?: NomenclatureItem[];
  nomenclature?: NomenclatureItem[];
}

/**
 * Best-effort iiko Cloud–style sync. API shapes differ by installation; we normalize common fields.
 */
export async function syncIikoNomenclature(
  organizationId: string,
  iikoOrganizationId?: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  const cred = await orgSettings.getIikoCredentials(organizationId);
  const base = (cred.iiko_api_url ?? '').replace(/\/$/, '');
  const apiKey = cred.iiko_api_key;
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  if (!base || !apiKey) {
    errors.push('iiko_api_url or iiko_api_key not configured for organization');
    return { created, updated, errors };
  }

  const started = Date.now();

  try {
    const tokenRes = await fetch(`${base}/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiLogin: apiKey }),
    });
    if (!tokenRes.ok) {
      errors.push(`auth failed: ${tokenRes.status}`);
      await logSync(organizationId, created, updated, errors, Date.now() - started);
      return { created, updated, errors };
    }
    const tokenJson = (await tokenRes.json()) as { token?: string };
    const token = tokenJson.token;
    if (!token) {
      errors.push('no token in auth response');
      await logSync(organizationId, created, updated, errors, Date.now() - started);
      return { created, updated, errors };
    }

    const orgPath = iikoOrganizationId ?? organizationId;
    const nomRes = await fetch(`${base}/nomenclature/${orgPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!nomRes.ok) {
      errors.push(`nomenclature failed: ${nomRes.status}`);
      await logSync(organizationId, created, updated, errors, Date.now() - started);
      return { created, updated, errors };
    }
    const nomJson = (await nomRes.json()) as IikoNomenclatureResponse;
    const rawList =
      nomJson.products ?? nomJson.items ?? nomJson.nomenclature ?? ([] as NomenclatureItem[]);

    for (const item of rawList) {
      const iikoId = item.id ?? item.code;
      const name = item.name ?? item.code ?? 'Unknown';
      if (!iikoId || item.type === 'GROUP') continue;

      const { rows: mapRows } = await pool.query<{ product_id: string }>(
        `SELECT product_id FROM iiko_products_mapping
         WHERE organization_id = $1::uuid AND iiko_product_id = $2`,
        [organizationId, String(iikoId)]
      );

      if (mapRows[0]) {
        await pool.query(
          `UPDATE products SET name = $2 WHERE id = $1::uuid AND organization_id = $3::uuid`,
          [mapRows[0].product_id, name.slice(0, 500), organizationId]
        );
        updated++;
      } else {
        const norm = name.toLowerCase().slice(0, 500);
        const { rows: ins } = await pool.query<{ id: string }>(
          `INSERT INTO products (organization_id, name, normalized_name, is_priority)
           VALUES ($1::uuid, $2, $3, false)
           RETURNING id`,
          [organizationId, name.slice(0, 500), norm]
        );
        const pid = ins[0]!.id;
        await pool.query(
          `INSERT INTO iiko_products_mapping (organization_id, product_id, iiko_product_id)
           VALUES ($1::uuid, $2::uuid, $3)`,
          [organizationId, pid, String(iikoId)]
        );
        created++;
      }
    }

    // Optional balances endpoint (if present)
    try {
      const balRes = await fetch(`${base}/balance/${orgPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (balRes.ok) {
        const bal = (await balRes.json()) as { balances?: Array<{ productId?: string; amount?: number }> };
        const list = bal.balances ?? [];
        for (const b of list) {
          if (b.productId == null || b.amount == null) continue;
          const { rows: m } = await pool.query<{ product_id: string }>(
            `SELECT product_id FROM iiko_products_mapping
             WHERE organization_id = $1::uuid AND iiko_product_id = $2`,
            [organizationId, String(b.productId)]
          );
          if (!m[0]) continue;
          await pool.query(
            `INSERT INTO product_stock (organization_id, product_id, current_stock, unit, updated_at)
             VALUES ($1::uuid, $2::uuid, $3::numeric, 'kg', NOW())
             ON CONFLICT (organization_id, product_id)
             DO UPDATE SET current_stock = EXCLUDED.current_stock, updated_at = NOW()`,
            [organizationId, m[0].product_id, b.amount]
          );
        }
      }
    } catch {
      /* balances optional */
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  await logSync(organizationId, created, updated, errors, Date.now() - started);
  logger.info({ organizationId, created, updated, errCount: errors.length }, 'iiko sync done');
  return { created, updated, errors };
}

async function logSync(
  organizationId: string,
  itemsCreated: number,
  itemsUpdated: number,
  errors: string[],
  durationMs: number
): Promise<void> {
  await pool.query(
    `INSERT INTO iiko_sync_log (organization_id, items_created, items_updated, errors, duration_ms)
     VALUES ($1::uuid, $2, $3, $4::jsonb, $5)`,
    [organizationId, itemsCreated, itemsUpdated, JSON.stringify(errors), durationMs]
  );
}

export async function lastIikoSyncStatus(organizationId: string): Promise<{
  synced_at: string | null;
  items_created: number;
  items_updated: number;
  errors: unknown;
} | null> {
  const { rows } = await pool.query<{
    synced_at: string;
    items_created: number;
    items_updated: number;
    errors: unknown;
  }>(
    `SELECT synced_at::text, items_created, items_updated, errors
     FROM iiko_sync_log
     WHERE organization_id = $1::uuid
     ORDER BY synced_at DESC
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] ?? null;
}
