import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function defaultDumpPath(): string {
  // Windows is case-insensitive, but keep both spellings for clarity.
  const a = path.resolve(__dirname, '../../AZbot/backup_supply_20260223_222631.sql');
  const b = path.resolve(__dirname, '../../AZBot/backup_supply_20260223_222631.sql');
  if (fs.existsSync(a)) return a;
  return b;
}

const DUMP_PATH = process.env.AZBOT_DUMP_PATH ?? defaultDumpPath();
const ORG_ID = process.env.TARGET_ORG_ID;

if (!ORG_ID) {
  console.error('Укажите TARGET_ORG_ID');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Укажите DATABASE_URL');
  process.exit(1);
}
if (!fs.existsSync(DUMP_PATH)) {
  console.error(`Файл не найден: ${DUMP_PATH}`);
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let suppliersCreated = 0;
  let suppliersUpdated = 0;
  let filtersImported = 0;

  try {
    await client.query('BEGIN');

    // 1. Временная схема
    await client.query('CREATE SCHEMA IF NOT EXISTS _azbot_import');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _azbot_import.suppliers (
        id          INTEGER PRIMARY KEY,
        name        VARCHAR(200),
        telegram_id BIGINT,
        phone       VARCHAR(50),
        is_active   BOOLEAN DEFAULT TRUE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS _azbot_import.filters (
        id          INTEGER PRIMARY KEY,
        supplier_id INTEGER,
        keyword     VARCHAR(100)
      );
    `);

    // 2. Загрузить INSERT-строки из дампа (только suppliers/filters)
    const dump = fs.readFileSync(DUMP_PATH, 'utf-8');
    const insertRe = /INSERT INTO (?:public\.)?(suppliers|filters)\b[\s\S]*?;/gi;
    let match: RegExpExecArray | null;
    let loaded = 0;
    while ((match = insertRe.exec(dump)) !== null) {
      const stmt = match[0];
      const adapted = stmt.replace(
        /INSERT INTO (?:public\.)?(suppliers|filters)/i,
        'INSERT INTO _azbot_import.$1'
      );
      try {
        // Some statements can fail due to conflicts/incomplete data — skip.
        await client.query(adapted);
        loaded++;
      } catch {
        // ignore
      }
    }
    console.log(`Дамп загружен во временную схему: INSERT-строк обработано=${loaded}`);

    // 3. Перенести поставщиков
    const { rows: azSuppliers } = await client.query<{
      id: number;
      name: string;
      telegram_id: string | null;
      phone: string | null;
      is_active: boolean | null;
    }>('SELECT * FROM _azbot_import.suppliers ORDER BY id');
    console.log(`Найдено поставщиков: ${azSuppliers.length}`);

    const idMap = new Map<number, string>();
    for (const s of azSuppliers) {
      if (!s.name) continue;
      const { rows: existing } = await client.query<{ id: string }>(
        `SELECT id FROM suppliers
         WHERE organization_id=$1::uuid AND lower(name)=lower($2)`,
        [ORG_ID, s.name]
      );
      const telegramId = s.telegram_id ? String(s.telegram_id) : null;
      const active = s.is_active ?? true;
      if (existing.length > 0) {
        const id = existing[0]!.id;
        await client.query(
          `
          UPDATE suppliers SET
            phone = COALESCE(NULLIF(phone,''), $1),
            telegram_chat_id = COALESCE(telegram_chat_id, $2::bigint),
            is_active = $3
          WHERE id = $4::uuid
          `,
          [s.phone, telegramId, active, id]
        );
        idMap.set(s.id, id);
        suppliersUpdated++;
        console.log(`  Обновлён: ${s.name}`);
      } else {
        const { rows } = await client.query<{ id: string }>(
          `
          INSERT INTO suppliers (organization_id, name, phone, telegram_chat_id, is_active)
          VALUES ($1::uuid,$2,$3,$4::bigint,$5)
          RETURNING id
          `,
          [ORG_ID, s.name, s.phone, telegramId, active]
        );
        const insId = rows[0]!.id;
        idMap.set(s.id, insId);
        suppliersCreated++;
        console.log(`  Создан: ${s.name}`);
      }
    }

    // 4. Перенести фильтры
    const { rows: azFilters } = await client.query<{ supplier_id: number; keyword: string }>(
      'SELECT supplier_id, keyword FROM _azbot_import.filters'
    );
    console.log(`Найдено фильтров: ${azFilters.length}`);
    for (const f of azFilters) {
      const vizorId = idMap.get(f.supplier_id);
      const keyword = (f.keyword ?? '').trim();
      if (!vizorId || !keyword) continue;
      await client.query(
        `
        INSERT INTO supplier_filters (organization_id, supplier_id, keyword)
        VALUES ($1::uuid,$2::uuid,$3)
        ON CONFLICT (supplier_id, keyword) DO NOTHING
        `,
        [ORG_ID, vizorId, keyword]
      );
      filtersImported++;
    }

    // 5. Очистить временную схему
    await client.query('DROP SCHEMA _azbot_import CASCADE');
    await client.query('COMMIT');

    console.log('');
    console.log('Импорт завершён:');
    console.log(`  Создано поставщиков:  ${suppliersCreated}`);
    console.log(`  Обновлено поставщиков: ${suppliersUpdated}`);
    console.log(`  Импортировано фильтров: ${filtersImported}`);
  } catch (err) {
    await client.query('ROLLBACK');
    await client.query('DROP SCHEMA IF EXISTS _azbot_import CASCADE').catch(() => {});
    console.error('Ошибка импорта:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();

