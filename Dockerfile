# syntax=docker/dockerfile:1.7
#
# CRM Hub - production image for Google Cloud Run.
#
# Targets:
#   runner   (default) - the web app. Next.js standalone server, listens on $PORT (Cloud Run sets 8080).
#   migrator           - one-shot job: `prisma migrate deploy` + production seed (run as a Cloud Run Job).
#
#   docker build -t crm-web .
#   docker build --target migrator -t crm-migrate .

ARG NODE_IMAGE=node:22-bookworm-slim
ARG YARN_VERSION=4.13.0

# ---------- base: Node + OpenSSL (required by Prisma) + Yarn ----------
FROM ${NODE_IMAGE} AS base
ARG YARN_VERSION
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare "yarn@${YARN_VERSION}" --activate
WORKDIR /app

# ---------- deps: install ALL dependencies (dev deps are needed for build + migrations) ----------
FROM base AS deps
# docker/yarn.lock + docker/.yarnrc.yml are the self-contained lockfile/config used for builds
# (the root yarn.lock/.yarnrc.yml belong to the original hosting platform and are not portable).
COPY package.json ./
COPY docker/yarn.lock docker/.yarnrc.yml ./
RUN yarn install --immutable \
 && yarn cache clean --all

# ---------- builder: generate Prisma client and build Next.js (standalone) ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production \
    NEXT_OUTPUT_MODE=standalone \
    NEXT_TRACING_ROOT=/app \
    NEXT_DIST_DIR=.next
RUN npx prisma generate && npx next build

# ---------- migrator: Cloud Run Job that applies migrations and seeds ----------
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY scripts/seed-production.ts ./scripts/seed-production.ts
RUN npx prisma generate
USER node
# ADMIN_EMAIL / ADMIN_PASSWORD (optional) create the first admin user on first run.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/seed-production.ts"]

# ---------- runner: minimal runtime image (default target) ----------
FROM ${NODE_IMAGE} AS runner
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Make sure the Prisma query engine for this platform is present in the runtime image.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER node
EXPOSE 8080
# Next.js standalone server honours $PORT and $HOSTNAME.
CMD ["node", "server.js"]
