import { pool } from '../../db/pool.js';

export async function getOrganizationSettings(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT organization_id, autopilot_mode, autopilot_days_threshold, updated_at
     FROM organization_settings WHERE organization_id = $1`,
    [organizationId]
  );
  return rows[0] ?? { autopilot_mode: 'disabled', autopilot_days_threshold: 3 };
}

export async function getAllOrganizationsWithAutopilot() {
  const { rows } = await pool.query(
    `SELECT organization_id, autopilot_mode, autopilot_days_threshold
     FROM organization_settings WHERE autopilot_mode != 'disabled'`
  );
  return rows;
}

export async function upsertOrganizationSettings(
  organizationId: string,
  autopilotMode: string,
  autopilotDaysThreshold: number
) {
  await pool.query(
    `INSERT INTO organization_settings (organization_id, autopilot_mode, autopilot_days_threshold, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (organization_id) DO UPDATE SET
       autopilot_mode = $2, autopilot_days_threshold = $3, updated_at = NOW()`,
    [organizationId, autopilotMode, autopilotDaysThreshold]
  );
}
