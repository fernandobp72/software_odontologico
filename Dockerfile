# Tres etapas para que cada despliegue ocupe poco disco:
#  - build: compila con todas las dependencias y genera el paquete autónomo de Next (output: standalone).
#  - tools: instala aparte solo lo necesario para migrar la base y crear el usuario inicial.
#  - runtime: la imagen final lleva el paquete autónomo + esas herramientas, sin código de desarrollo.
FROM node:22-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

FROM base AS tools
WORKDIR /tools
COPY package-lock.json /tmp/lock.json
# Mismas versiones que el proyecto (tomadas del package-lock).
RUN npm init -y >/dev/null \
 && npm i --no-audit --no-fund \
    "prisma@$(node -p "require('/tmp/lock.json').packages['node_modules/prisma'].version")" \
    "tsx@$(node -p "require('/tmp/lock.json').packages['node_modules/tsx'].version")" \
    "bcryptjs@$(node -p "require('/tmp/lock.json').packages['node_modules/bcryptjs'].version")" \
 && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=tools /tools /tools
EXPOSE 3000

# Aplica migraciones, crea el usuario inicial si SEED_PASSWORD (consultorio) o SEED_PLATFORM_EMAIL (cuenta de plataforma) están definidas (idempotente) y arranca.
# NODE_PATH solo para el seed: bcryptjs viene en las herramientas, no en el paquete autónomo.
CMD ["sh", "-c", "/tools/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && { { [ -z \"$SEED_PASSWORD\" ] && [ -z \"$SEED_PLATFORM_EMAIL\" ]; } || NODE_PATH=/tools/node_modules /tools/node_modules/.bin/tsx prisma/seed.ts || true; } && node server.js"]
