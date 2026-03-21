import { api, cleanDb, createTestOrg } from '../helpers/testApp.js';
import { pool } from '../../src/db/pool.js';

afterEach(async () => {
  await cleanDb();
});

describe('GET /api/documents/:id', () => {
  it('возвращает ocr_confidence и parse_source', async () => {
    const { token, orgId } = await createTestOrg();
    const {
      rows: [doc],
    } = await pool.query<{ id: string }>(
      `INSERT INTO documents
       (organization_id, file_path, source_type, status,
        ocr_confidence, ocr_engine, parse_source)
       VALUES ($1::uuid, 'test.pdf', 'web', 'parsed', 0.92, 'google_vision', 'llm')
       RETURNING id`,
      [orgId]
    );
    const docId = doc!.id;

    const res = await api.get(`/api/documents/${docId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ocr_confidence).toBe(0.92);
    expect(res.body.parse_source).toBe('llm');
  });
});
