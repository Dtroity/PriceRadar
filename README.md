# Vizor360

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
docker run -d --name vizor360-pg -e POSTGRES_USER=vizor360 -e POSTGRES_PASSWORD=vizor360 -e POSTGRES_DB=vizor360 -p 5432:5432 pgvector/pgvector:pg15
docker run -d --name vizor360-redis -p 6379:6379 redis:7-alpine
```

### 3. Backend

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

По умолчанию создаётся пользователь `admin@vizor360.local` / `admin123`.

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

Миграции при первом запуске лучше выполнить локально, указав `DATABASE_URL=postgresql://vizor360:vizor360@localhost:5432/vizor360`.

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
/vizor360
  /backend    — Express API, парсеры, воркеры, Telegram-бот
  /frontend   — React SPA
  /shared     — общие типы
  .env.example
  docker-compose.yml
```

## Лицензия

Proprietary. Разработчик: **VizoR360**.

---

# Proviator Platform

Мульти-тенантная платформа автоматизации закупок ресторанов: мониторинг цен, AI-парсинг прайсов и накладных, сопоставление товаров, прогноз цен, интеграция с iiko / R-keeper / Poster.

**Powered by VizoR360**

## Экосистема Провиатор

Модули платформы (UI):

| Модуль | Описание |
|--------|----------|
| **Scan** | Провиатор Скан — AI-обработка накладных |
| **Prices** | Провиатор Цены — мониторинг цен поставщиков |
| **Forecast** | Провиатор Прогноз — прогноз цен |
| **FoodCost** | Провиатор Фудкост — себестоимость кухни |
| **Suppliers** | Провиатор Поставщики — поставщики и рекомендации |
| **Orders** | Провиатор Заказы — автоматизация заказов (ex-AZbot) |

## Архитектура

- **Client:** Web, Telegram, API
- **Backend API:** Node.js, Express, TypeScript
- **AI Service:** Python, FastAPI (парсинг накладных, прогнозы Prophet/XGBoost)
- **Document Engine:** загрузка, OCR (Tesseract / Google Vision), парсинг, валидация
- **Product Matching:** fuzzy, pg_trgm, AI
- **Integration Service:** iiko (MVP), R-keeper, Poster
- **БД:** PostgreSQL (расширения pg_trgm, uuid-ossp), Redis, BullMQ

## Multi-tenant

- Один домен (например `https://procureai.app`), у каждого ресторана свой workspace: `procureai.app` или `restaurant-name.procureai.app`.
- Сущность **organizations** (id, name, slug). Все данные с `organization_id`.
- Пользователи: `users` (organization_id, email, role: owner | admin | manager | viewer).
- Telegram: `telegram_users` (organization_id, is_allowed). Бот закрытый: «Access denied. Contact administrator» до разрешения доступа.

## Установка и запуск (Proviator)

### 1. Окружение

```bash
cp .env.example .env
# Выставить MULTI_TENANT=true, DATABASE_URL, TELEGRAM_BOT_TOKEN, AI_SERVICE_URL при необходимости. APP_NAME=Proviator
```

### 2. БД и миграции

```bash
# PostgreSQL и Redis (Docker)
docker compose -f docker-compose.procureai.yml up -d postgres redis

# Миграция мульти-тенантной схемы
cd backend && npm run db:migrate:procureai
```

База по умолчанию: `procureai` / пользователь `procureai` (см. docker-compose.procureai.yml).

### 3. Backend

```bash
cd backend
export MULTI_TENANT=true
export DATABASE_URL=postgresql://procureai:procureai@localhost:5432/procureai
npm run dev
```

### 4. AI Service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Frontend

```bash
cd frontend
npm run dev
```

Откройте http://localhost:5173. Регистрация: «Register» → имя организации, slug, email, пароль (создаётся workspace и пользователь-owner). Вход: workspace slug + email + пароль.

### 6. Docker (полный стек)

```bash
docker compose -f docker-compose.procureai.yml up -d
```

Перед первым запуском выполнить миграцию Proviator к той же БД (например, через временный backend контейнер или локально).

Nginx: порты 80/443, проксирование на frontend, backend (/api/), ai-service (/ai/).

## API (Proviator)

- **Auth (multi-tenant):**  
  `POST /api/auth/register-org` (organizationName, slug, email, password)  
  `POST /api/auth/login-org` (email, password, organizationSlug)
- Остальные эндпоинты как в Vizor360; в мульти-тенантном режиме данные изолированы по `organization_id` (из JWT).

## Разделы Web

- **Dashboard** — главная, сводка и мониторинг цен
- **Скан** (Провиатор Скан) — накладные, загрузка, AI-обработка
- **Цены** (Провиатор Цены) — изменения цен
- **Прогноз** (Провиатор Прогноз) — прогнозы на 7/14/30 дней
- **Фудкост** (Провиатор Фудкост) — себестоимость кухни
- **Поставщики** (Провиатор Поставщики) — поставщики
- **Заказы** (Провиатор Заказы) — автоматизация заказов
- **Integrations** — iiko, R-keeper, Poster
- **Settings** — настройки организации
- **Telegram** — управление доступом к боту (owner/admin)

## Telegram-бот

- Приветствие: **Провиатор — AI помощник закупок ресторана**
- Команды: `/upload`, `/supplier`, `/foodcost`, `/price-alerts`
- Мульти-тенантность: пользователь привязан к организации; доступ после разрешения в веб-панели.

## Безопасность

- JWT (access + refresh), role-based access.
- Секреты и API-ключи через переменные окружения.
- Шифрование чувствительных данных в БД (рекомендуется для продакшена).

## Интеграция (iiko)

- В разделе Integrations указать учётные данные iiko (apiLogin, token, baseUrl).
- Функции: получение организаций/складов/товаров, создание входящей накладной (stub реализован в `backend/src/services/iiko.ts`).
