import { pool } from '../db/pool.js';

export type NotifyEventsConfig = {
  anomaly_high?: boolean;
  anomaly_medium?: boolean;
  recommendation?: boolean;
  order_status?: boolean;
  price_report_weekly?: boolean;
};

const DEFAULT_EVENTS: Required<NotifyEventsConfig> = {
  anomaly_high: true,
  anomaly_medium: false,
  recommendation: true,
  order_status: true,
  price_report_weekly: false,
};

export type OrgNotifyRow = {
  notify_email: string | null;
  notify_email_enabled: boolean;
  vk_notify_phone: string | null;
  vk_notify_enabled: boolean;
  webpush_enabled: boolean;
  notify_events: NotifyEventsConfig | null;
  telegram_chat_id: string | null;
  telegram_notify: NotifyEventsConfig | null;
};

export async function getOrgNotifyRow(organizationId: string): Promise<OrgNotifyRow | null> {
  const { rows } = await pool.query<{
    notify_email: string | null;
    notify_email_enabled: boolean;
    vk_notify_phone: string | null;
    vk_notify_enabled: boolean;
    webpush_enabled: boolean;
    notify_events: NotifyEventsConfig | null;
    telegram_chat_id: string | null;
    telegram_notify: NotifyEventsConfig | null;
  }>(
    `SELECT notify_email, COALESCE(notify_email_enabled, FALSE) AS notify_email_enabled,
            vk_notify_phone, COALESCE(vk_notify_enabled, FALSE) AS vk_notify_enabled,
            COALESCE(webpush_enabled, TRUE) AS webpush_enabled,
            notify_events, telegram_chat_id::text, telegram_notify
     FROM organizations WHERE id = $1::uuid`,
    [organizationId]
  );
  return rows[0] ?? null;
}

export function mergeNotifyEvents(org: OrgNotifyRow): Required<NotifyEventsConfig> {
  const ne = { ...DEFAULT_EVENTS, ...(org.notify_events ?? {}), ...(org.telegram_notify ?? {}) };
  return {
    anomaly_high: ne.anomaly_high ?? DEFAULT_EVENTS.anomaly_high,
    anomaly_medium: ne.anomaly_medium ?? DEFAULT_EVENTS.anomaly_medium,
    recommendation: ne.recommendation ?? DEFAULT_EVENTS.recommendation,
    order_status: ne.order_status ?? DEFAULT_EVENTS.order_status,
    price_report_weekly: ne.price_report_weekly ?? DEFAULT_EVENTS.price_report_weekly,
  };
}

export async function patchOrgNotifySettings(
  organizationId: string,
  patch: Partial<{
    notify_email: string | null;
    notify_email_enabled: boolean;
    vk_notify_phone: string | null;
    vk_notify_enabled: boolean;
    webpush_enabled: boolean;
    notify_events: NotifyEventsConfig;
  }>
): Promise<void> {
  const cur = await getOrgNotifyRow(organizationId);
  if (!cur) return;
  const notify_email = patch.notify_email !== undefined ? patch.notify_email : cur.notify_email;
  const notify_email_enabled =
    patch.notify_email_enabled !== undefined ? patch.notify_email_enabled : cur.notify_email_enabled;
  const vk_notify_phone =
    patch.vk_notify_phone !== undefined ? patch.vk_notify_phone : cur.vk_notify_phone;
  const vk_notify_enabled =
    patch.vk_notify_enabled !== undefined ? patch.vk_notify_enabled : cur.vk_notify_enabled;
  const webpush_enabled =
    patch.webpush_enabled !== undefined ? patch.webpush_enabled : cur.webpush_enabled;
  const notify_events = patch.notify_events
    ? { ...mergeNotifyEvents(cur), ...patch.notify_events }
    : mergeNotifyEvents(cur);
  await pool.query(
    `UPDATE organizations SET
       notify_email = $2,
       notify_email_enabled = $3,
       vk_notify_phone = $4,
       vk_notify_enabled = $5,
       webpush_enabled = $6,
       notify_events = $7::jsonb
     WHERE id = $1::uuid`,
    [
      organizationId,
      notify_email,
      notify_email_enabled,
      vk_notify_phone,
      vk_notify_enabled,
      webpush_enabled,
      JSON.stringify(notify_events),
    ]
  );
}
