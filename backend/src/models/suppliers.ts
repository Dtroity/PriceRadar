import { pool } from '../db/pool.js';
import type { Supplier } from '../types/index.js';

export async function getAllSuppliers(): Promise<Supplier[]> {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM suppliers ORDER BY name'
  );
  return rows;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM suppliers WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createSupplier(name: string): Promise<Supplier> {
  const { rows } = await pool.query(
    'INSERT INTO suppliers (name) VALUES ($1) RETURNING id, name, created_at',
    [name]
  );
  return rows[0];
}

export async function findOrCreateSupplier(name: string): Promise<Supplier> {
  const trimmed = name.trim();
  const existing = await pool.query(
    'SELECT id, name, created_at FROM suppliers WHERE LOWER(name) = LOWER($1)',
    [trimmed]
  );
  if (existing.rows[0]) return existing.rows[0];
  return createSupplier(trimmed);
}
