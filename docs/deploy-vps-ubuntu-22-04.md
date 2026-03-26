# Деплой Vizor360 на VPS (Ubuntu 22.04) — Docker Compose + Caddy (HTTPS)

Цель: поднять Postgres+Redis+backend+frontend+Prometheus+Grafana из `docker-compose.yml` и дать HTTPS на домены:
- `vizor360.ru`
- `vizor360.online`

VPS: Ubuntu 22.04, IP `157.22.172.104`.

## 0) DNS

В панели DNS (timeweb.cloud) выставить A-записи:
- `vizor360.ru` → `157.22.172.104`
- `www.vizor360.ru` → `157.22.172.104` (опционально)
- `vizor360.online` → `157.22.172.104`
- `www.vizor360.online` → `157.22.172.104` (опционально)

Подождать обновления DNS (обычно 5–30 минут).

## 1) Подготовка сервера

Подключиться по SSH:

```bash
ssh root@157.22.172.104
```

Обновить систему и поставить базовые утилиты:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 2) Установка Docker и Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

## 3) Развёртывание проекта в /opt/vizor360

```bash
mkdir -p /opt/vizor360
cd /opt/vizor360
git clone https://github.com/<YOUR_GITHUB>/<YOUR_REPO>.git .
```

Если репозиторий приватный — используйте SSH-ключи или токен.

## 4) Конфигурация окружения

Создать `/opt/vizor360/.env` (не коммитить):

```bash
nano /opt/vizor360/.env
```

Минимальный шаблон (под `docker-compose.yml` этого проекта):

```env
NODE_ENV=production
MULTI_TENANT=true

# БД (внутри docker сети хост = postgres)
DATABASE_URL=postgresql://vizor360:СИЛЬНЫЙ_ПАРОЛЬ@postgres:5432/vizor360

# Redis (backend читает HOST/PORT)
REDIS_HOST=redis
REDIS_PORT=6379

# JWT (генерировать дважды)
JWT_ACCESS_SECRET=СГЕНЕРИРОВАТЬ
JWT_REFRESH_SECRET=СГЕНЕРИРОВАТЬ

# Приложение
FRONTEND_URL=https://vizor360.ru
PORT=3001
LOG_LEVEL=info

# OCR (если используете)
GOOGLE_APPLICATION_CREDENTIALS=/app/keys/google.json

# AI — YandexGPT (опционально)
YANDEX_API_KEY=
YANDEX_FOLDER_ID=

# Email — Timeweb SMTP
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@vizor360.ru
SMTP_PASS=ПАРОЛЬ_ИЗ_TIMEWEB
SMTP_FROM=Vizor360 <info@vizor360.ru>

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:info@vizor360.ru

# Telegram (резервный канал)
TELEGRAM_BOT_ENABLED=false
TELEGRAM_BOT_TOKEN=

# VK Notify (опционально)
VK_NOTIFY_TOKEN=

# Sentry (опционально)
SENTRY_DSN=

# Grafana (для docker-compose)
GRAFANA_ADMIN_PASSWORD=СГЕНЕРИРОВАТЬ
```

Сгенерировать секреты:

```bash
openssl rand -hex 64   # JWT_ACCESS_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET
```

VAPID:

```bash
cd /opt/vizor360/backend
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k)"
```

Если используете Google Vision — положить ключ в `/opt/vizor360/keys/google.json`:

```bash
mkdir -p /opt/vizor360/keys
nano /opt/vizor360/keys/google.json
chmod 600 /opt/vizor360/keys/google.json
```

## 5) Caddy (HTTPS reverse proxy)

**Порядок:** файл `Caddyfile` можно создать заранее. Контейнер `caddy` с `--network vizor360_default` запускайте **после** первого успешного `docker compose up` (шаг 6), иначе сети ещё нет. Если Caddy уже запущен — достаточно обновить `Caddyfile`, `docker network connect …` и `caddy reload` (команды ниже).

Создать файл `/opt/vizor360/Caddyfile`:

```bash
nano /opt/vizor360/Caddyfile
```

Содержимое:

```caddyfile
{
  email info@vizor360.ru
}

vizor360.ru, www.vizor360.ru {
  encode gzip
  reverse_proxy vizor360-frontend:80
}

vizor360.online, www.vizor360.online {
  encode gzip
  reverse_proxy vizor360-frontend:80
}

# API можно обслуживать по /api (через frontend уже проксируется),
# но на всякий случай можно открыть прямой домен:
api.vizor360.ru {
  encode gzip
  reverse_proxy vizor360-backend:3001
}
```

**Важно:** Caddy запускается **в отдельном контейнере**. Запись `localhost:5173` в Caddyfile указывает на **localhost внутри контейнера Caddy**, а не на сервер — в итоге **502 Bad Gateway**. Нужны **имена контейнеров** и **внутренние** порты: у frontend внутри образа это **80** (хостовый `5173` — только проброс снаружи).

Запуск сервисов приложения (см. шаг 6) создаёт сеть вида **`vizor360_default`** (имя каталога проекта + `_default`). Проверка: `docker network ls`.

Запустить Caddy **в той же сети**, что и `docker compose` (после первого успешного `docker compose up`):

```bash
docker rm -f caddy || true
docker run -d --name caddy \
  --restart unless-stopped \
  --network vizor360_default \
  -p 80:80 -p 443:443 \
  -v /opt/vizor360/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2
docker logs -n 50 caddy
```

Если Caddy уже был запущен без `--network`, подключите сеть и перезагрузите конфиг:

```bash
docker network connect vizor360_default caddy
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

(Если `network connect` ругается на «already connected» — достаточно обновить Caddyfile и выполнить `reload`.)

## 6) Запуск сервисов приложения

На хосте frontend доступен как **`127.0.0.1:5173`** (`5173:80` в compose). Для Caddy в Docker используйте **`vizor360-frontend:80`** (см. шаг 5).

```bash
cd /opt/vizor360
docker compose pull
docker compose up -d --build
docker compose ps
```

## 7) Миграции БД

Запуск миграций внутри backend-контейнера:

```bash
cd /opt/vizor360
docker compose exec backend npm run migrate:latest
```

Если миграции требуют `DATABASE_URL` — он уже задан в `docker-compose.yml` (и/или из `.env`).

## 8) Проверка

Логи:

```bash
cd /opt/vizor360
docker compose logs -n 200 --no-color backend
docker compose logs -n 200 --no-color frontend
```

Healthcheck backend:

```bash
curl -sS http://localhost:3001/api/health | jq .
```

Проверка доменов:
- открыть `https://vizor360.ru`
- открыть `https://vizor360.online`

## 9) Обновление (deploy новой версии)

```bash
cd /opt/vizor360
git pull
docker compose up -d --build
docker compose exec backend npm run migrate:latest
docker compose logs -n 50 backend
```

## 10) Импорт поставщиков из AZbot (после деплоя)

1) Положить дамп в `/opt/vizor360/AZbot/backup_supply_20260223_222631.sql` (не коммитить).
2) Узнать `ORG_ID`:

```bash
cd /opt/vizor360
docker compose exec postgres psql -U vizor360 -d vizor360 -c "SELECT id, name FROM organizations ORDER BY created_at DESC;"
```

3) Запуск импорта:

```bash
cd /opt/vizor360/backend
TARGET_ORG_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
DATABASE_URL=postgresql://vizor360:СИЛЬНЫЙ_ПАРОЛЬ@postgres:5432/vizor360 \
npm run import:azbot
```

## Примечания

- `AZbot/*.sql` должен быть в `.gitignore` (персональные данные).
- Grafana: порт `3002` наружу, логин `admin`, пароль `GRAFANA_ADMIN_PASSWORD`.
- Postgres/Redis по умолчанию проброшены наружу в compose; для продакшена лучше закрыть их на уровне firewall или убрать публикацию портов.

