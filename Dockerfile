# ── 1. Frontend (Angular) ────────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build:prod

# ── 2. Backend (TypeScript → dist/) ──────────────────────────────────────────
FROM node:22-alpine AS api
WORKDIR /api
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ── 3. Imagen final: solo dependencias de producción ─────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PUBLIC_DIR=/app/public
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=api /api/dist ./dist
COPY --from=web /web/dist/turnero-app/browser ./public
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
