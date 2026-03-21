import { pool } from '../db/pool.js';

export type TelegramNotifySettings = {
  anomaly_high?: boolean;
  anomaly_medium?: boolean;
  recommendation?: boolean;
  order_status?: boolean;
};

const DEFAULT_NOTIFY: TelegramNotifySettings = {
  anomaly_high: true,
  anomaly_medium: false,
  recommendation: true,
  order_status: true,
};

export async function getTelegramSettings(organizationId: string): Promise<{
  telegram_chat_id: string | null;
  telegram_notify: TelegramNotifySettings;
}> {
  const { rows } = await pool.query<{
    telegram_chat_id: string | null;
    telegram_notify: TelegramNotifySettings | null;
  }>(`SELECT telegram_chat_id::text, telegram_notify FROM organizations WHERE id = $1::uuid`, [
    organizationId,
  ]);
  const r = rows[0];
  return {
    telegram_chat_id: r?.telegram_chat_id ?? null,
    telegram_notify: { ...DEFAULT_NOTIFY, ...(r?.telegram_notify ?? {}) },
  };
}

export async function saveTelegramOrgSettings(
  organizationId: string,
  data: { telegram_chat_id?: string | null; telegram_notify?: TelegramNotifySettings }
): Promise<void> {
  const cur = await getTelegramSettings(organizationId);
  const notify = { ...cur.telegram_notify, ...data.telegram_notify };
  let chatId = cur.telegram_chat_id;
  if (data.telegram_chat_id !== undefined) {
    chatId =
      data.telegram_chat_id === null || data.telegram_chat_id === ''
        ? null
        : data.telegram_chat_id;
  }
  await pool.query(
    `UPDATE organizations SET telegram_chat_id = $2::bigint, telegram_notify = $3::jsonb WHERE id = $1::uuid`,
    [organizationId, chatId, JSON.stringify(notify)]
  );
}

export async function getIikoCredentials(organizationId: string): Promise<{
  iiko_api_url: string | null;
  iiko_api_key: string | null;
}> {
  const { rows } = await pool.query<{ iiko_api_url: string | null; iiko_api_key: string | null }>(
    `SELECT iiko_api_url, iiko_api_key FROM organizations WHERE id = $1::uuid`,
    [organizationId]
  );
  return rows[0] ?? { iiko_api_url: null, iiko_api_key: null };
}

export async function saveIikoOrgSettings(
  organizationId: string,
  data: { iiko_api_url?: string | null; iiko_api_key?: string | null }
): Promise<void> {
  const cur = await getIikoCredentials(organizationId);
  await pool.query(
    `UPDATE organizations SET iiko_api_url = $2, iiko_api_key = $3 WHERE id = $1::uuid`,
    [
      organizationId,
      data.iiko_api_url !== undefined ? data.iiko_api_url : cur.iiko_api_url,
      data.iiko_api_key !== undefined ? data.iiko_api_key : cur.iiko_api_key,
    ]
  );
}
