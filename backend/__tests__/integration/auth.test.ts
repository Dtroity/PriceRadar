import { api, cleanDb, createTestOrg, createTestProduct } from '../helpers/testApp.js';

afterEach(async () => {
  await cleanDb();
});

describe('POST /api/auth/register-org', () => {
  it('создаёт org и возвращает токен', async () => {
    const res = await api.post('/api/auth/register-org').send({
      organizationName: 'TestCo',
      slug: `co-${Date.now()}`,
      email: `a-${Date.now()}@test.com`,
      password: 'pass123',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('дублирующий slug → 409', async () => {
    const slug = `dup-${Date.now()}`;
    await api.post('/api/auth/register-org').send({
      organizationName: 'A',
      slug,
      email: 'a1@test.com',
      password: 'pass123',
    });
    const res = await api.post('/api/auth/register-org').send({
      organizationName: 'B',
      slug,
      email: 'b1@test.com',
      password: 'pass123',
    });
    expect(res.status).toBe(409);
  });
});

describe('Изоляция организаций', () => {
  it('токен org A не даёт доступ к продуктам org B', async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    await createTestProduct(orgB.orgId, 'Secret Product');
    const res = await api.get('/api/products').set('Authorization', `Bearer ${orgA.token}`);
    expect(res.status).toBe(200);
    const names = (res.body.products as Array<{ name: string }>).map((p) => p.name);
    expect(names.every((n) => n !== 'Secret Product')).toBe(true);
  });
});
