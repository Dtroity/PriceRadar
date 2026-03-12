import { pool } from '../db/pool.js';
export async function getAllProducts() {
    const { rows } = await pool.query('SELECT id, name, normalized_name, is_priority, created_at FROM products ORDER BY is_priority DESC, name');
    return rows;
}
export async function getProductById(id) {
    const { rows } = await pool.query('SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE id = $1', [id]);
    return rows[0] ?? null;
}
export async function findProductByNormalizedName(normalizedName) {
    const { rows } = await pool.query('SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE normalized_name = $1', [normalizedName]);
    return rows[0] ?? null;
}
export async function createProduct(name, normalizedName, isPriority = false) {
    const { rows } = await pool.query(`INSERT INTO products (name, normalized_name, is_priority) VALUES ($1, $2, $3)
     RETURNING id, name, normalized_name, is_priority, created_at`, [name, normalizedName, isPriority]);
    return rows[0];
}
export async function findOrCreateProduct(name, normalizedName, isPriority = false) {
    const existing = await findProductByNormalizedName(normalizedName);
    if (existing) {
        if (isPriority && !existing.is_priority) {
            await pool.query('UPDATE products SET is_priority = TRUE WHERE id = $1', [existing.id]);
            return { ...existing, is_priority: true };
        }
        return existing;
    }
    return createProduct(name, normalizedName, isPriority);
}
export async function setProductPriority(productId, isPriority) {
    await pool.query('UPDATE products SET is_priority = $1 WHERE id = $2', [isPriority, productId]);
}
