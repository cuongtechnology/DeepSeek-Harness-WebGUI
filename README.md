<div align="center">

<img src="https://raw.githubusercontent.com/cuongtechnology/DeepSeek-Harness-WebGUI/main/docs/assets/logo.svg" alt="DeepSeek Harness WebGUI" width="80" />

# ⚡ DeepSeek Harness WebGUI

**A self-hosted web control plane for AI coding agents.**

Drive [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — projects, sessions, terminal, Git, MCP, and approvals — entirely from your browser. No terminal required.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](#requirements)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-f69220?logo=pnpm&logoColor=white)](#requirements)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![Status](https://img.shields.io/badge/status-beta-9cf)](#roadmap)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick Start](#quick-start) · [Features](#features) · [Architecture](#architecture) · [Configuration](#configuration) · [Docs](#documentation) · [Roadmap](#roadmap)

> **DeepSeek Harness WebGUI is an independent open-source project and is not
> affiliated with or endorsed by DeepSeek.**

</div>

---

## What is this?

DeepSeek Harness WebGUI is a **browser-based control plane** for AI coding
agents. It wraps the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
runtime behind a clean interface and gives you a VS Code–like workspace to work
alongside your agent in real time.

It is **not** a replacement for the agent runtime and **not** a wrapper around a
generic LLM API — it drives DeepSeek Harness over its **official SDK wire
protocol** (stdio JSON-RPC) and renders the developer workspace around it.

Think: **VS Code Web × Claude Code × OpenHands**, self-hosted.

## The workspace

```
┌──────────────────────────────────────────────────────────────────┐
│  Header  ·  project switcher  ·  agent status  ·  settings       │
├─────────────┬────────────────────────────────┬───────────────────┤
│             │                                │  Agent            │
│  Explorer   │      Monaco Editor             │  ─────────        │
│  files      │      tabs · search · diff      │  chat             │
│  git tree   │                                │  tool calls       │
│  search     │                                │  plan / tasks     │
│             │                                │  approvals        │
├─────────────┴────────────────────────────────┴───────────────────┤
│  Terminal  ·  Logs  ·  Git  ·  Tasks  ·  Agent logs               │
└──────────────────────────────────────────────────────────────────┘
```

## Features

**Projects & workspaces**
- Create projects from an empty workspace, an existing directory, or a Git URL
- Isolated workspace per project, with optional Docker sandboxing

**Editor**
- Monaco editor with tabs, syntax highlighting, save, and file search
- Command palette and resizable, keyboard-driven panels

**Agent sessions**
- Start, message, stream, interrupt, and inspect sessions in real time
- Normalized event model: messages, tool calls/results, file changes, commands,
  status transitions, subagents, approvals, and errors

**Terminal**
- xterm.js + node-pty terminals bound to the project workspace
- Resize, reconnecting, and per-session lifecycle

**Git**
- Status, diff, log, branches, checkout, stage/unstage, commit, pull, push
- Monaco diff viewer for changed files

**MCP**
- Add, enable, disable, and inspect stdio MCP servers; view tools and status
- Secrets never exposed in logs or API responses

**Approvals & permissions**
- Category policies (`shell`, `filesystem`, `network`, `git`, `package_install`)
  with `allow` / `ask` / `deny` and an allow-once / allow-always approval UI

**Multi-runtime**
- The agent layer is a single `AgentAdapter` interface — DeepSeek Harness is the
  first implementation; Claude Code, Codex, and OpenHands adapters drop in.

## Architecture

```
Browser
   ↓  HTTP + WebSocket (socket.io)
WebGUI  apps/web (Next.js) ──► apps/api (NestJS)
                                   │
                    AgentService ──┤
                                   │
                            AgentAdapter   (interface)
                                   │
                      DeepSeekHarnessAdapter
                                   │
        official DeepSeek Harness  (dsh-jsonrpc-agent · stdio JSON-RPC)
                                   ↓
                     agent runtime · plugins · tools
```

A pnpm + Turborepo monorepo:

```
apps/
  web/          Next.js frontend (App Router, Tailwind, shadcn-style UI)
  api/          NestJS backend (REST + socket.io gateways, Swagger)
packages/
  ui/           shared React UI primitives
  database/     Prisma client + schema
  agent-sdk/    AgentAdapter contract + registry
  harness/      DeepSeek Harness adapter (JSON-RPC SDK protocol)
  terminal/     node-pty terminal manager
  git/          Git operations (simple-git)
  mcp/          MCP stdio client + manager
  shared/       types, constants, validation, path-safety, scrypt hashing
workers/
  agent-worker/    BullMQ worker for background agent jobs
  sandbox-worker/  BullMQ worker for sandbox lifecycle jobs
prisma/        PostgreSQL schema
```

See [docs/architecture.md](docs/architecture.md) for the full design.

## Requirements

| Dependency | Version |
| ---------- | ------- |
| Node.js | ≥ 20 (≥ 22.19 recommended — the harness itself requires it) |
| pnpm | ≥ 9 |
| PostgreSQL | 16 |
| Redis | 7 |
| Docker | optional — for sandboxes and the containerized stack |
| `dsh-jsonrpc-agent` | the official DeepSeek Harness SDK runtime (see below) |

## Quick Start

### Option A — Docker (recommended)

```bash
git clone https://github.com/cuongtechnology/DeepSeek-Harness-WebGUI.git
cd DeepSeek-Harness-WebGUI

# Provide the official SDK runtime binary (built from upstream, or from the
# DeepSeek Harness Python SDK runtime wheel).
mkdir -p harness-bin
cp /path/to/dsh-jsonrpc-agent harness-bin/

cp .env.example .env      # edit values if needed (JWT_SECRET, DEEPSEEK_API_KEY, …)
docker compose up -d --build
```

| Service | URL |
| ------- | --- |
| Web UI | http://localhost:3000 |
| API | http://localhost:3001/api |
| Swagger | http://localhost:3001/api/docs |

### Option B — Local development

```bash
git clone https://github.com/cuongtechnology/DeepSeek-Harness-WebGUI.git
cd DeepSeek-Harness-WebGUI

# 1. Start Postgres + Redis (dev infra only)
docker compose -f docker-compose.dev.yml up -d

# 2. Install and configure
cp .env.example .env      # defaults already target localhost; set JWT_SECRET + DEEPSEEK_API_KEY
pnpm install

# 3. Create the schema and seed the initial admin user
pnpm db:push
pnpm db:seed

# 4. Run (web + api + workers, with hot reload)
pnpm dev
```

The web UI is served at `http://localhost:3000`; the API at
`http://localhost:3001/api` (Swagger at `http://localhost:3001/api/docs`).

## Configuration

All configuration is environment-driven. Key variables:

### DeepSeek Harness runtime

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `DEEPSEEK_HARNESS_COMMAND` | `dsh-jsonrpc-agent` | SDK runtime executable the adapter spawns |
| `DEEPSEEK_HARNESS_ARGS` | *(empty)* | Extra args passed to the runtime (split on whitespace) |
| `DEEPSEEK_HARNESS_PROVIDER` | `deepseek-official` | Provider passed to `initialize` |
| `DEEPSEEK_HARNESS_MODEL` | `deepseek-v4-flash` | Model passed to `initialize` |
| `DEEPSEEK_HARNESS_MAX_TOKENS` | *(empty)* | Optional max tokens |
| `DEEPSEEK_HARNESS_TIMEOUT_MS` | `300000` | Runtime idle/response timeout |
| `DEEPSEEK_HARNESS_KILL_MS` | `3000` | Grace window before force-kill |

### Runtime environment (inherited by the subprocess)

| Variable | Description |
| -------- | ----------- |
| `DEEPSEEK_API_KEY` | Credential read by the harness LLM adapter |
| `DEEPSEEK_BASE_URL` | Optional base URL override |
| `DSH_*` | Extra harness options (cwd, model, session root, system prompt, config) |

### Platform

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `DATABASE_URL` | `postgresql://webgui:webgui@localhost:5432/webgui` | PostgreSQL DSN |
| `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` | `localhost:6379` | Redis connection |
| `JWT_SECRET` | — | **Required.** Set a long random string |
| `WORKSPACES_ROOT` | `/data/workspaces` | Root for project workspaces |
| `SANDBOX_IMAGE` | `node:22-slim` | Image used by the Docker sandbox |
| `AUTH_ALLOW_REGISTRATION` | `true` | Disable public registration after first admin |

> **Note:** when running under Docker Compose, `DATABASE_URL`, `REDIS_*`, and the
> harness command are overridden automatically to the container network — no
> manual hostname edits needed. See `.env.example` for the complete list.

See [docs/deepseek-harness.md](docs/deepseek-harness.md) for the full integration
contract and [docs/deployment.md](docs/deployment.md) for production details.

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | Next.js · React · TypeScript · Tailwind CSS · shadcn-style UI · Monaco Editor · xterm.js · Zustand |
| Backend | NestJS · socket.io · BullMQ |
| Data | PostgreSQL · Prisma · Redis |
| Agents | DeepSeek Harness (official `dsh-jsonrpc-agent` JSON-RPC SDK protocol) |
| Tooling | pnpm · Turborepo · ESLint · Prettier · Vitest · Playwright |
| Deploy | Docker · Docker Compose |

## Documentation

| Doc | What it covers |
| --- | -------------- |
| [docs/architecture.md](docs/architecture.md) | System design, layers, and data flow |
| [docs/deepseek-harness.md](docs/deepseek-harness.md) | DeepSeek Harness integration contract and event model |
| [docs/development.md](docs/development.md) | Local setup, scripts, and conventions |
| [docs/deployment.md](docs/deployment.md) | Production Docker deployment and hardening |
| [docs/mcp.md](docs/mcp.md) | MCP server configuration and management |
| [docs/security.md](docs/security.md) | Security model, boundaries, and limitations |

## Roadmap

- [ ] Claude Code / Codex / OpenHands adapters
- [ ] Multi-user collaboration and project sharing
- [ ] Fine-grained per-tool approval policies persisted to the database
- [ ] Metrics and tracing (OpenTelemetry)
- [ ] File watching for instant agent-change visibility
- [ ] OAuth provider support (GitHub, Google, …)

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines,
and run the full check suite before opening a PR:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Security

Security is a first-class requirement: scrypt password hashing, httpOnly session
cookies, per-route authorization, DTO validation, rate limiting, path-traversal
protection, secret redaction, audit logging, and an approval gate before
sensitive actions.

To report a vulnerability, see [SECURITY.md](SECURITY.md) and
[docs/security.md](docs/security.md).

## License

[AGPL-3.0](LICENSE). Dependencies retain their own licenses. DeepSeek Harness
itself is MIT-licensed and is integrated over its public SDK protocol — it is
not vendored or relicensed.

## Disclaimer

DeepSeek Harness WebGUI is an independent open-source project and is not
affiliated with or endorsed by DeepSeek.
