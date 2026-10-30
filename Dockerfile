FROM node:22-bookworm-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=http

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000

# Aplica migraciones, crea el usuario inicial si SEED_PASSWORD está definida (idempotente) y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && { [ -z \"$SEED_PASSWORD\" ] || npx prisma db seed || true; } && npm run start -- -H 0.0.0.0 -p 3000"]
