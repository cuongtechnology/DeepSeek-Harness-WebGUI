# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# DeepSeek Harness WebGUI — multi-stage build.
# Targets: `deps` (install), `build` (compile monorepo), then `web`, `api`,
# `worker` runtime images. The DeepSeek Harness SDK runtime binary is NOT
# bundled; mount it into the api/worker container and point
# DEEPSEEK_HARNESS_COMMAND at it (see docs/deployment.md).
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY workers ./workers
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile || pnpm install

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm build

# ── web ──────────────────────────────────────────────────────────────────────
FROM base AS web
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "node_modules/.bin/next", "start", "-p", "3000"]

# ── api ──────────────────────────────────────────────────────────────────────
FROM base AS api
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ── worker ───────────────────────────────────────────────────────────────────
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=build /app/workers ./workers
COPY --from=deps /app/workers/agent-worker/package.json ./workers/agent-worker/package.json
WORKDIR /app/workers/agent-worker
CMD ["node", "dist/main.js"]
