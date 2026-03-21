import { api, cleanDb, createTestOrg, createTestProduct, createTestSupplier } from '../helpers/testApp.js';
import { pool } from '../../src/db/pool.js';

afterEach(async () => {
  await cleanDb();
});

describe('GET /api/analytics/prices/history', () => {
  it('возвращает series для товара с ценами', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const supplierId = await createTestSupplier(orgId);
    const {
      rows: [pl],
    } = await pool.query<{ id: string }>(
      `INSERT INTO price_lists (organization_id, supplier_id, upload_date, source_type)
       VALUES ($1::uuid, $2::uuid, CURRENT_DATE, 'web') RETURNING id`,
      [orgId, supplierId]
    );
    await pool.query(
      `INSERT INTO prices (price_list_id, product_id, price, currency)
       VALUES ($1::uuid, $2::uuid, 100.00, 'RUB')`,
      [pl!.id, productId]
    );

    const res = await api
      .get(`/api/analytics/prices/history?product_id=${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(1);
    expect(res.body.series[0].points).toHaveLength(1);
  });

  it('GET /api/analytics/prices/summary — рост ~20% совпадает с first/last в prices', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const supplierId = await createTestSupplier(orgId);
    const {
      rows: [pl],
    } = await pool.query<{ id: string }>(
      `INSERT INTO price_lists (organization_id, supplier_id, upload_date, source_type)
       VALUES ($1::uuid, $2::uuid, CURRENT_DATE, 'web') RETURNING id`,
      [orgId, supplierId]
    );
    await pool.query(
      `INSERT INTO prices (price_list_id, product_id, price, currency, created_at)
       VALUES ($1::uuid, $2::uuid, 100.00, 'RUB', NOW() - INTERVAL '3 days')`,
      [pl!.id, productId]
    );
    await pool.query(
      `INSERT INTO prices (price_list_id, product_id, price, currency, created_at)
       VALUES ($1::uuid, $2::uuid, 120.00, 'RUB', NOW())`,
      [pl!.id, productId]
    );

    const hist = await api
      .get(`/api/analytics/prices/history?product_id=${productId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(hist.status).toBe(200);
    expect(hist.body.stats.price_change_pct).toBeCloseTo(20, 5);

    const sum = await api
      .get('/api/analytics/prices/summary?period_days=30')
      .set('Authorization', `Bearer ${token}`);
    expect(sum.status).toBe(200);
    const growing = sum.body.top_growing as Array<{ product: { id: string }; change_pct: number }>;
    const hit = growing.find((g) => g.product.id === productId);
    expect(hit).toBeDefined();
    expect(hit!.change_pct).toBeCloseTo(20, 5);
  });
});
