# syntax=docker/dockerfile:1
#
# DEFI Movember — application image
#
# Build context is the repository root, not this directory:
#   docker build -f deploy/Dockerfile -t defi-movember .
#
# No secret is ever baked in. Every value is injected at runtime from the
# env file held on the server (CLAUDE.md §9, architecture §8.1). The one
# exception is APP_VERSION, which is a commit sha — not a secret.

# --- Stage 1: dependencies ------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Copied on their own so this layer is only rebuilt when the lockfile moves,
# not on every source change.
COPY package.json package-lock.json ./
RUN npm ci


# --- Stage 2: build -------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Stamped into the build so /api/health can report which build is running.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# --- Stage 3: runtime -----------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Re-declared here on purpose: Docker stages do not inherit each other's ENV,
# and the value is read at runtime by /api/health — not inlined at build time,
# since Next only inlines NEXT_PUBLIC_* variables. Without this, every image
# would report the fallback version from package.json.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

# Unprivileged user: a container escape should not land on root
# (architecture §9.5).
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# `standalone` carries the traced server and its dependencies. Static assets
# and `public/` are not included in it and must be copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Uses Node's built-in fetch rather than curl or wget, so the runtime image
# needs no extra package for its own healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
