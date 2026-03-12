# PriceRadar

Production-ready MVP системы мониторинга цен поставщиков для ресторанного бизнеса. Анализ прайс-листов, сравнение цен, уведомления в Telegram.

**Powered by VizoR360**

## Стек

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **DB:** PostgreSQL
- **Queue:** BullMQ + Redis
- **Telegram:** node-telegram-bot-api
- **Парсинг:** exceljs, pdf-parse, mammoth

## Быстрый старт (локально)

### 1. Окружение

```bash
cp .env.example .env
# Отредактируйте .env: DATABASE_URL, JWT_*_SECRET, при необходимости TELEGRAM_BOT_TOKEN
```

### 2. PostgreSQL и Redis

Убедитесь, что запущены PostgreSQL и Redis (или используйте Docker только для них):

```bash
docker run -d --name priceradar-pg -e POSTGRES_USER=priceradar -e POSTGRES_PASSWORD=priceradar -e POSTGRES_DB=priceradar -p 5432:5432 postgres:15-alpine
docker run -d --name priceradar-redis -p 6379:6379 redis:7-alpine
```

### 3. Backend

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

По умолчанию создаётся пользователь `admin@priceradar.local` / `admin123`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173, войдите с учётными данными выше.

## Запуск через Docker

```bash
cp .env.example .env
# Заполните JWT_ACCESS_SECRET, JWT_REFRESH_SECRET и при необходимости TELEGRAM_BOT_TOKEN

docker compose up -d postgres redis
cd backend && npm run db:migrate && npm run db:seed
docker compose up -d backend
cd frontend && npm run dev
```

Либо полный стек (frontend в виде production-сборки за nginx):

```bash
docker compose up -d
# Миграции и сид нужно выполнить один раз внутри backend-контейнера или локально к postgres
docker compose exec backend node dist/db/migrate.js  # если миграции вынесены в dist
```

Миграции при первом запуске лучше выполнить локально, указав `DATABASE_URL=postgresql://priceradar:priceradar@localhost:5432/priceradar`.

## Функции MVP

- **Авторизация:** JWT, регистрация, вход, refresh, роли (admin, manager, viewer).
- **Загрузка прайсов:** Web (drag & drop), Excel/CSV/PDF/DOC, очередь BullMQ.
- **Сравнение цен:** автоматическое после загрузки нового прайса, запись в `price_changes`.
- **Priority products:** отметка приоритетных товаров, отдельные уведомления (⚠️ PRIORITY PRICE CHANGE).
- **Dashboard:** последние изменения, фильтры по поставщику/дате/приоритету, таблица с цветовой индикацией.
- **Telegram-бот:** закрытый доступ; при первом контакте — «Access denied. Contact administrator.»; админ добавляет пользователей в Web-панели. Команда `/upload`, приём файлов и фото.
- **Footer:** «Powered by VizoR360» (минималистичный, в подвале).

## API (кратко)

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/suppliers`, `GET /api/products`, `PATCH /api/products/:id/priority`
- `GET /api/price-changes` (query: supplierId, fromDate, toDate, priorityOnly, minPercent, maxPercent)
- `GET /api/price-changes/product/:productId/history`
- `POST /api/upload` (multipart: file, supplierName, sourceType)
- `GET /api/telegram/status`, `GET /api/telegram/users` (admin), `PATCH /api/telegram/users/:telegramId/allow`, `DELETE /api/telegram/users/:id`

## Структура

```
/priceradar
  /backend    — Express API, парсеры, воркеры, Telegram-бот
  /frontend   — React SPA
  /shared     — общие типы
  .env.example
  docker-compose.yml
```

## Лицензия

Proprietary. Разработчик: **VizoR360**.
