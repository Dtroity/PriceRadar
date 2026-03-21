import { api, cleanDb, createTestOrg, createTestProduct } from '../helpers/testApp.js';
import { pool } from '../../src/db/pool.js';

afterEach(async () => {
  await cleanDb();
});

describe('price anomaly flow', () => {
  it('вставка аномалии и acknowledge', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const {
      rows: [row],
    } = await pool.query<{ id: string }>(
      `INSERT INTO price_anomalies
       (organization_id, product_id, price_before, price_after,
        change_pct, direction, severity)
       VALUES ($1::uuid, $2::uuid, 100, 135, 35, 'up', 'high') RETURNING id`,
      [orgId, productId]
    );
    const anomalyId = row!.id;

    const list = await api.get('/api/analytics/anomalies').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const ids = (list.body.anomalies as Array<{ id: string }>).map((a) => a.id);
    expect(ids).toContain(anomalyId);

    const ack = await api
      .patch(`/api/analytics/anomalies/${anomalyId}/acknowledge`)
      .set('Authorization', `Bearer ${token}`);
    expect(ack.status).toBe(200);
    expect(ack.body.ok).toBe(true);
  });
});
