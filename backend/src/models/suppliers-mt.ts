import { pool } from '../db/pool.js';
import type { Supplier } from '../types/index.js';

export async function getAllByOrganization(organizationId: string): Promise<Supplier[]> {
  const { rows } = await pool.query(
    `
    SELECT
      s.id,
      s.organization_id,
      s.name,
      s.created_at,
      s.contact_name,
      s.email,
      s.phone,
      s.telegram_account,
      s.telegram_chat_id,
      s.notify_channel,
      s.is_active,
      COALESCE(COUNT(f.id), 0)::int AS filters_count
    FROM suppliers s
    LEFT JOIN supplier_filters f ON f.supplier_id = s.id
    WHERE s.organization_id = $1
    GROUP BY s.id
    ORDER BY s.name
    `,
    [organizationId]
  );
  return rows;
}

export async function getById(id: string, organizationId: string): Promise<Supplier | null> {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      organization_id,
      name,
      created_at,
      contact_name,
      email,
      phone,
      telegram_account,
      telegram_chat_id,
      notify_channel,
      is_active,
      invite_token,
      account_user_id
    FROM suppliers
    WHERE id = $1 AND organization_id = $2
    `,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function deleteById(id: string, organizationId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM suppliers WHERE id = $1 AND organization_id = $2',
    [id, organizationId]
  );
  return rowCount > 0;
}

export async function findOrCreate(
  organizationId: string,
  name: string
): Promise<Supplier> {
  const trimmed = name.trim();
  const { rows: existing } = await pool.query(
    'SELECT id, organization_id, name, created_at FROM suppliers WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
    [organizationId, trimmed]
  );
  if (existing[0]) return existing[0];
  const { rows: created } = await pool.query(
    'INSERT INTO suppliers (organization_id, name) VALUES ($1, $2) RETURNING id, organization_id, name, created_at',
    [organizationId, trimmed]
  );
  return created[0];
}
