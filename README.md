# DeepSeek Harness WebGUI

A modern, self-hosted web control plane for AI coding agents, initially targeting
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).

Open your agent in a browser: a VS Code-like workspace with a file explorer, a
Monaco editor, streaming agent chat, tool-call visibility, an integrated
terminal, Git integration, MCP server management, and an approval gate for
sensitive actions — all backed by a NestJS API.

> **DeepSeek Harness WebGUI is an independent open-source project and is not
> affiliated with or endorsed by DeepSeek.**

![Screenshot placeholder](docs/assets/screenshot.png)

## Overview

The WebGUI acts as a *control plane*, not a replacement for the agent runtime.
It drives the official DeepSeek Harness through its public SDK protocol and
renders the developer workspace around it.

```
Browser
   ↓
WebGUI (Next.js + NestJS)
   ↓
DeepSeek Harness Adapter
   ↓
Official DeepSeek Harness (dsh-jsonrpc-agent SDK runtime)
   ↓
Agent runtime / plugins / tools
```

## Features

- **Projects & workspaces** — create projects from an empty workspace or a Git
  repository; each project owns an isolated workspace directory.
- **File explorer & editor** — secure workspace browsing, Monaco editor with
  tabs, save, and syntax highlighting.
- **Agent sessions** — start, message, stream, interrupt, and inspect agent
  sessions in real time over WebSocket.
- **Real-time events** — streaming assistant output, tool calls, file changes,
  status transitions, and errors — no polling.
- **Terminal** — xterm.js + node-pty terminals bound to the project workspace.
- **Git** — status, diff, log, branches, stage/unstage, commit, pull, push.
- **MCP servers** — add, enable, connect, and inspect stdio MCP servers.
- **Approval system** — permission categories (shell, filesystem, network, git,
  package install) with allow/ask/deny policies and an approval UI.
- **Sandboxing** — optional Docker-backed project sandboxes.
- **Multi-runtime** — the agent layer is an adapter interface; DeepSeek Harness
  is the first implementation, with Claude Code / Codex / OpenHands easy to add.

## Architecture

A pnpm + Turborepo monorepo:

```
apps/
  web/        Next.js frontend
  api/        NestJS backend (REST + WebSocket gateways)
packages/
  ui/         shared React UI primitives
  database/   Prisma client + schema
  agent-sdk/  AgentAdapter contract
  harness/    DeepSeek Harness adapter (JSON-RPC SDK protocol)
  terminal/   node-pty terminal manager
  git/        Git operations (simple-git)
  mcp/        MCP stdio client + manager
  shared/     types, constants, validation, path-safety utils
workers/
  agent-worker/    BullMQ worker for background agent jobs
  sandbox-worker/  BullMQ worker for sandbox lifecycle jobs
```

See [docs/architecture.md](docs/architecture.md) for details.

## Requirements

- Node.js >= 20 (>= 22.19 recommended; the harness itself requires >= 22.19)
- pnpm >= 9
- PostgreSQL 16
- Redis 7
- Docker (optional, for sandboxes and the containerized deployment)
- The official `dsh-jsonrpc-agent` runtime binary (see below)

## Installation

```bash
git clone https://github.com/your-org/deepseek-harness-webgui.git
cd deepseek-harness-webgui
cp .env.example .env
# edit .env — set DATABASE_URL, JWT_SECRET, and the harness configuration
pnpm install
pnpm --filter @deepseek-harness/database db:push   # create the schema
pnpm --filter @deepseek-harness/database db:seed   # create the admin user
pnpm build
pnpm dev
```

The web UI is served at `http://localhost:3000`; the API at
`http://localhost:3001/api` (Swagger at `http://localhost:3001/api/docs`).

## Docker deployment

```bash
# Provide the official runtime binary
mkdir -p harness-bin
cp /path/to/dsh-jsonrpc-agent harness-bin/

docker compose up -d --build
```

See [docs/deployment.md](docs/deployment.md).

## Development

```bash
pnpm install
pnpm dev          # run everything with hot reload
pnpm build        # build all packages and apps
pnpm lint
pnpm test
pnpm typecheck
```

See [docs/development.md](docs/development.md).

## Agent configuration

The adapter drives DeepSeek Harness through its **official SDK wire protocol**
(stdio JSON-RPC: `initialize`, `session/prompt`, `shutdown` + `session.event`,
`session.status`, `subagent.*` notifications). It does **not** shell out to an
undocumented CLI and does **not** wrap a generic LLM API.

Key environment variables:

```env
DEEPSEEK_HARNESS_COMMAND=dsh-jsonrpc-agent   # the runtime executable
DEEPSEEK_HARNESS_ARGS=
DEEPSEEK_HARNESS_PROVIDER=deepseek-official
DEEPSEEK_HARNESS_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=...                         # read by the runtime
DEEPSEEK_BASE_URL=
```

See [docs/agents.md](docs/agents.md) for the full integration contract.

## Security

Security is a first-class requirement: hashed passwords, httpOnly session
cookies, per-route authorization, DTO validation, rate limiting, path-traversal
protection, secret redaction, audit logging, and an approval gate before
sensitive actions. See [docs/security.md](docs/security.md) and
[SECURITY.md](SECURITY.md).

## Roadmap

- Claude Code / Codex / OpenHands adapters
- Multi-user collaboration and project sharing
- Fine-grained per-tool approval policies persisted to the database
- Metrics and tracing (OpenTelemetry)
- File watching for instant agent-change visibility

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE). Dependencies retain their own licenses; see their
respective packages and `THIRD_PARTY_NOTICES` where applicable. DeepSeek
Harness itself is MIT-licensed and is integrated over its public SDK protocol,
not vendored.

## Disclaimer

DeepSeek Harness WebGUI is an independent open-source project and is not
affiliated with or endorsed by DeepSeek.
