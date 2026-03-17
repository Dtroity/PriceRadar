import { pool } from '../db/pool.js';
import type { Supplier } from '../types/index.js';

export async function getAllByOrganization(organizationId: string): Promise<Supplier[]> {
  const { rows } = await pool.query(
    'SELECT id, organization_id, name, created_at FROM suppliers WHERE organization_id = $1 ORDER BY name',
    [organizationId]
  );
  return rows;
}

export async function getById(id: string, organizationId: string): Promise<Supplier | null> {
  const { rows } = await pool.query(
    'SELECT id, organization_id, name, created_at FROM suppliers WHERE id = $1 AND organization_id = $2',
    [id, organizationId]
  );
  return rows[0] ?? null;
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
