# Development

## Prerequisites

- Node.js >= 20 (>= 22.19 recommended)
- pnpm >= 9
- PostgreSQL 16 and Redis 7 (easiest via `docker compose -f docker-compose.dev.yml up -d`)

## Setup

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d     # postgres + redis
pnpm --filter @deepseek-harness/database db:push   # apply the schema
pnpm --filter @deepseek-harness/database db:seed   # create the admin user
```

## Running

```bash
pnpm dev            # turbo: web (Next dev) + api (nest watch)
```

Or individually:

```bash
pnpm --filter @deepseek-harness/api dev
pnpm --filter @deepseek-harness/web dev
```

## Checks

```bash
pnpm build          # build all packages + apps (dependency-ordered)
pnpm lint           # eslint across packages
pnpm typecheck      # tsc --noEmit across packages
pnpm test           # vitest across packages
```

## Testing

Unit and protocol-level tests live next to their source (`src/*.test.ts`). The
harness and MCP packages exercise their transports against a mock JSON-RPC
server spawned via `node -e` — a real protocol-level integration, not a mocked
success response. Git tests run against a temp repository.

Run a single package's tests with
`pnpm --filter @deepseek-harness/harness test`.

## Adding a package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json` (extend
   `@deepseek-harness/config-typescript/base.json`), and `.eslintrc.cjs`.
2. Add it to `pnpm-workspace.yaml` (already covered by the glob).
3. Build/typecheck/lint per the root scripts.

## Environment variables

See `.env.example`. The adapter and workers read the same harness configuration;
do not hard-code paths or secrets.
