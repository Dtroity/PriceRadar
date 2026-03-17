import { pool } from '../db/pool.js';
import type { Organization } from '../types/index.js';

export async function findBySlug(slug: string): Promise<Organization | null> {
  const { rows } = await pool.query(
    'SELECT id, name, slug, created_at FROM organizations WHERE slug = $1',
    [slug.toLowerCase().trim()]
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Organization | null> {
  const { rows } = await pool.query(
    'SELECT id, name, slug, created_at FROM organizations WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function create(name: string, slug: string): Promise<Organization> {
  const s = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const { rows } = await pool.query(
    'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
    [name, s || 'org']
  );
  return rows[0];
}
