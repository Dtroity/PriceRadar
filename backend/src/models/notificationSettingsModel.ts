import { pool } from '../db/pool.js';

export type NotificationSettingRow = {
  event_type: string;
  channel: string;
  enabled: boolean;
  include_details: unknown;
};

export async function listByOrganization(organizationId: string): Promise<NotificationSettingRow[]> {
  const { rows } = await pool.query<NotificationSettingRow>(
    `
    SELECT event_type, channel, enabled, include_details
    FROM notification_settings
    WHERE organization_id = $1::uuid
    ORDER BY event_type, channel
    `,
    [organizationId]
  );
  return rows;
}

export async function upsertMany(
  organizationId: string,
  items: Array<{
    event_type: string;
    channel: string;
    enabled: boolean;
    include_details?: unknown;
  }>
): Promise<void> {
  for (const it of items) {
    await pool.query(
      `
      INSERT INTO notification_settings (organization_id, event_type, channel, enabled, include_details)
      VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
      ON CONFLICT (organization_id, event_type, channel)
      DO UPDATE SET enabled = EXCLUDED.enabled, include_details = EXCLUDED.include_details
      `,
      [
        organizationId,
        it.event_type,
        it.channel,
        it.enabled,
        JSON.stringify(it.include_details ?? { items: false, total: false, link: true }),
      ]
    );
  }
}

