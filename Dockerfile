# ─── El More — Dockerfile для Timeweb Cloud Apps ──────────────
# Используем lean-образ Node 22 LTS.
FROM node:22-alpine

WORKDIR /app

# Сначала зависимости — кэш слоёв.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Затем код.
COPY . .

# Каталог с пользовательскими данными.
# В Timeweb Apps смонтируйте сюда persistent volume.
ENV DATA_DIR=/data
RUN mkdir -p /data/uploads /data/backups

# Открываемый порт.
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 3000

# Healthcheck — Timeweb проверяет «жив» ли контейнер.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["node", "server.js"]
