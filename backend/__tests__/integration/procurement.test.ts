import { api, cleanDb, createTestOrg, createTestProduct } from '../helpers/testApp.js';
import { pool } from '../../src/db/pool.js';
import { generateRecommendations } from '../../src/services/recommendationEngine.js';

afterEach(async () => {
  await cleanDb();
});

describe('Создание заявки и позиций', () => {
  it('POST /orders → draft, POST /items → позиция добавлена', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const order = await api
      .post('/api/procurement/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Тест закупка' });
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('draft');
    const orderId = order.body.id;

    const item = await api
      .post(`/api/procurement/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: productId, quantity: 10, unit: 'кг' });
    expect(item.status).toBe(201);
  });
});

describe('Переходы статусов', () => {
  it('draft → pending → approved — валидная цепочка', async () => {
    const { token } = await createTestOrg();
    const { body: order } = await api
      .post('/api/procurement/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T' });
    const id = order.id;
    await api
      .patch(`/api/procurement/orders/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });
    const res = await api
      .patch(`/api/procurement/orders/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('received → pending — недопустимый переход → 400', async () => {
    const { token } = await createTestOrg();
    const { body: order } = await api
      .post('/api/procurement/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T' });
    const id = order.id;
    for (const s of ['pending', 'approved', 'ordered', 'received'] as const) {
      await api
        .patch(`/api/procurement/orders/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: s });
    }
    const res = await api
      .patch(`/api/procurement/orders/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });
});

describe('Изоляция org', () => {
  it('заявка org A не видна org B', async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    await api
      .post('/api/procurement/orders')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ title: 'Private order' });
    const res = await api.get('/api/procurement/orders').set('Authorization', `Bearer ${orgB.token}`);
    expect(res.status).toBe(200);
    const titles = (res.body.orders as Array<{ title: string | null }>).map((o) => o.title);
    expect(titles.every((t) => t !== 'Private order')).toBe(true);
  });
});

describe('Рекомендации закупок', () => {
  it('PATCH accept → создаёт заявку со статусом draft, рекомендация accepted', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const {
      rows: [rec],
    } = await pool.query<{ id: string }>(
      `INSERT INTO procurement_recommendations
       (organization_id, product_id, reason, suggested_qty, suggested_price, status)
       VALUES ($1::uuid, $2::uuid, 'low_stock', 10, 100, 'active') RETURNING id`,
      [orgId, productId]
    );
    const res = await api
      .patch(`/api/procurement/recommendations/${rec!.id}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const r = await pool.query<{ status: string; order_id: string | null }>(
      'SELECT status, order_id FROM procurement_recommendations WHERE id = $1',
      [rec!.id]
    );
    expect(r.rows[0]!.status).toBe('accepted');
    expect(r.rows[0]!.order_id).not.toBeNull();
    const o = await pool.query<{ status: string }>('SELECT status FROM procurement_orders WHERE id = $1', [
      r.rows[0]!.order_id,
    ]);
    expect(o.rows[0]!.status).toBe('draft');
  });

  it('PATCH dismiss → статус dismissed', async () => {
    const { token, orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    const {
      rows: [rec],
    } = await pool.query<{ id: string }>(
      `INSERT INTO procurement_recommendations
       (organization_id, product_id, reason, suggested_qty, suggested_price, status)
       VALUES ($1::uuid, $2::uuid, 'low_stock', 5, 50, 'active') RETURNING id`,
      [orgId, productId]
    );
    const res = await api
      .patch(`/api/procurement/recommendations/${rec!.id}/dismiss`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const q = await pool.query<{ status: string }>(
      'SELECT status FROM procurement_recommendations WHERE id = $1',
      [rec!.id]
    );
    expect(q.rows[0]!.status).toBe('dismissed');
  });

  it('повторная генерация не дублирует active low_stock', async () => {
    const { orgId } = await createTestOrg();
    const productId = await createTestProduct(orgId);
    await pool.query(
      `INSERT INTO procurement_recommendations
       (organization_id, product_id, reason, suggested_qty, suggested_price, status)
       VALUES ($1::uuid, $2::uuid, 'low_stock', 10, 100, 'active')`,
      [orgId, productId]
    );
    await pool.query(
      `INSERT INTO product_stock (organization_id, product_id, current_stock, min_stock)
       VALUES ($1::uuid, $2::uuid, 1, 10)
       ON CONFLICT (organization_id, product_id) DO UPDATE SET
         current_stock = EXCLUDED.current_stock,
         min_stock = EXCLUDED.min_stock`,
      [orgId, productId]
    );
    await generateRecommendations(orgId);
    const res = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM procurement_recommendations
       WHERE organization_id = $1::uuid AND reason = 'low_stock' AND status = 'active'`,
      [orgId]
    );
    expect(Number(res.rows[0]!.c)).toBe(1);
  });
});
