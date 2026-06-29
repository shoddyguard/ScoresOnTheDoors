# Multi-stage build for standalone Next.js + SQLite
# Use Debian-based image (NOT Alpine) to include tzdata for IANA timezone support
FROM node:26-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends gosu openssl && rm -rf /var/lib/apt/lists/*

# ---- deps stage ----
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/
RUN npm ci

# ---- builder stage ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the container's OS
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ---- runner stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
# (no public/ copy: the app has no static assets yet. If you add a public/
#  folder, also add: COPY --from=builder /app/public ./public)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Full dependency tree (overrides the trimmed standalone node_modules) so the
# Prisma CLI and its complete dependency closure are present for `prisma db push`
# at startup. The Next standalone bundle alone omits the CLI.
COPY --from=builder /app/node_modules ./node_modules

# Entrypoint script to migrate DB then start app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# SQLite data directory (mount a volume here)
RUN mkdir -p /data && chown nextjs:nodejs /data

# Container starts as root so the entrypoint can adjust UID/GID at runtime.
# The entrypoint drops to the nextjs user via gosu before exec'ing the app.

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Default DB location (the mounted /data volume). Override at deploy time if needed.
ENV DATABASE_URL="file:/data/app.db"

CMD ["./docker-entrypoint.sh"]
