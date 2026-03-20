import { pool } from '../db/pool.js';
export async function createPriceChange(productId, supplierId, oldPrice, newPrice, isPriority, organizationId) {
    const changeValue = newPrice - oldPrice;
    const changePercent = oldPrice !== 0 ? (changeValue / oldPrice) * 100 : 0;
    if (organizationId) {
        const { rows } = await pool.query(`INSERT INTO price_changes (organization_id, product_id, supplier_id, old_price, new_price, change_value, change_percent, is_priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, product_id, supplier_id, old_price, new_price, change_value, change_percent, is_priority, created_at`, [organizationId, productId, supplierId, oldPrice, newPrice, changeValue, changePercent, isPriority]);
        return rows[0];
    }
    const { rows } = await pool.query(`INSERT INTO price_changes (product_id, supplier_id, old_price, new_price, change_value, change_percent, is_priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, product_id, supplier_id, old_price, new_price, change_value, change_percent, is_priority, created_at`, [productId, supplierId, oldPrice, newPrice, changeValue, changePercent, isPriority]);
    return rows[0];
}
export async function getPriceChanges(filters = {}, limit = 100) {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;
    if (filters.organizationId) {
        conditions.push(`pc.organization_id = $${idx++}`);
        params.push(filters.organizationId);
    }
    if (filters.supplierId) {
        conditions.push(`pc.supplier_id = $${idx++}`);
        params.push(filters.supplierId);
    }
    if (filters.fromDate) {
        conditions.push(`pc.created_at >= $${idx++}`);
        params.push(filters.fromDate);
    }
    if (filters.toDate) {
        conditions.push(`pc.created_at <= $${idx++}`);
        params.push(filters.toDate);
    }
    if (filters.minPercent != null) {
        conditions.push(`pc.change_percent >= $${idx++}`);
        params.push(filters.minPercent);
    }
    if (filters.maxPercent != null) {
        conditions.push(`pc.change_percent <= $${idx++}`);
        params.push(filters.maxPercent);
    }
    if (filters.priorityOnly) {
        conditions.push('pc.is_priority = TRUE');
    }
    params.push(limit);
    const { rows } = await pool.query(`SELECT pc.id, pc.product_id, pc.supplier_id, pc.old_price, pc.new_price, pc.change_value, pc.change_percent, pc.is_priority, pc.created_at,
            p.name AS product_name, s.name AS supplier_name
     FROM price_changes pc
     JOIN products p ON p.id = pc.product_id
     JOIN suppliers s ON s.id = pc.supplier_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY pc.created_at DESC
     LIMIT $${idx}`, params);
    return rows;
}
export async function getPriceHistory(productId, supplierId) {
    let query = `
    SELECT pl.upload_date::text AS date, pr.price
    FROM prices pr
    JOIN price_lists pl ON pl.id = pr.price_list_id
    WHERE pr.product_id = $1
  `;
    const params = [productId];
    if (supplierId) {
        params.push(supplierId);
        query += ` AND pl.supplier_id = $2`;
    }
    query += ` ORDER BY pl.upload_date ASC`;
    const { rows } = await pool.query(query, params);
    return rows;
}
