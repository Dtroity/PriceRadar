FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY shared/ ../shared/
COPY backend/ ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache poppler-utils
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY backend/knexfile.cjs ./knexfile.cjs
COPY backend/migrations ./migrations
COPY db/init.sql ./db-init.sql
RUN mkdir -p uploads
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
