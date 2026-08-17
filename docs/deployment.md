# Deployment

## Docker Compose (production)

The stack runs `web`, `api`, `worker`, `postgres`, and `redis`.

1. Provide the official DeepSeek Harness SDK runtime binary:

   ```bash
   mkdir -p harness-bin
   cp /path/to/dsh-jsonrpc-agent harness-bin/
   ```

   The binary is produced by the upstream `scripts/build-exe-for-python-sdk.ts`
   or shipped in the `deepseek-harness-runtime-bin` wheel. See
   [docs/deepseek-harness.md](deepseek-harness.md#obtaining-the-runtime).

2. Configure environment:

   ```bash
   cp .env.example .env
   # set JWT_SECRET, DEEPSEEK_API_KEY, and (optionally)
   # DEEPSEEK_HARNESS_COMMAND=/opt/dsh/dsh-jsonrpc-agent
   ```

3. Start:

   ```bash
   docker compose up -d --build
   ```

4. Apply the database schema and seed the admin user (once):

   ```bash
   docker compose exec api node -e "require('./node_modules/@deepseek-harness/database/dist/index.js')"
   docker compose run --rm api sh -c "cd ../database && pnpm db:deploy && pnpm db:seed"
   ```

   In practice, run migrations from the repo checkout against the `postgres`
   service, or add a one-shot migrate container.

## How the harness reaches the API/worker

The `dsh-jsonrpc-agent` runtime is **not** bundled into the containers. It is
mounted at `/opt/dsh` (the `harness-bin/` directory) and referenced via
`DEEPSEEK_HARNESS_COMMAND`. The runtime reads `DEEPSEEK_API_KEY` /
`DEEPSEEK_BASE_URL` and `DSH_*` variables from the container environment, which
are passed through unchanged.

## Reverse proxy (optional)

Serve `web` and `api` behind a single origin with TLS. The browser talks to the
API WebSocket namespaces (`/agent`, `/terminal`) directly at
`NEXT_PUBLIC_API_URL`; ensure your proxy forwards WebSocket upgrades for those
namespaces.

## Troubleshooting

- **Agent won't start**: check `DEEPSEEK_HARNESS_COMMAND` points to the mounted
  binary and the runtime's `DEEPSEEK_API_KEY` is set. The API logs the spawn
  failure with a stderr tail.
- **Database errors**: confirm `DATABASE_URL` and that migrations ran.
- **WebSocket disconnects**: confirm `NEXT_PUBLIC_API_URL` is reachable from the
  browser and the proxy forwards WS.
