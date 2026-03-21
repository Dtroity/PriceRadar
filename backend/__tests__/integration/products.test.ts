import { api, cleanDb, createTestOrg, createTestProduct } from '../helpers/testApp.js';
import { pool } from '../../src/db/pool.js';

afterEach(async () => {
  await cleanDb();
});

describe('POST /api/products/merge', () => {
  it('объединяет товары и создаёт audit-запись', async () => {
    const { token, orgId, userId } = await createTestOrg('org_admin');
    const p1 = await createTestProduct(orgId, 'Молоко 1л');
    const p2 = await createTestProduct(orgId, 'Молоко 1 л');
    const res = await api
      .post('/api/products/merge')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceProductIds: [p2], targetProductId: p1 });
    expect(res.status).toBe(200);

    const check = await pool.query('SELECT id FROM products WHERE id=$1::uuid', [p2]);
    expect(check.rows).toHaveLength(0);

    const audit = await pool.query(
      `SELECT * FROM product_audit_log WHERE product_id=$1::uuid AND action='merge' AND actor_id=$2::uuid`,
      [p1, userId]
    );
    expect(audit.rows).toHaveLength(1);
  });
});
