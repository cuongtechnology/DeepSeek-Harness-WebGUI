# MCP (Model Context Protocol)

The WebGUI manages **stdio MCP servers** so their tools can be inspected and, in
future, surfaced to agents.

## How it works

- `packages/mcp` implements the MCP stdio transport (JSON-RPC 2.0 over
  newline-delimited stdio): `initialize`, `tools/list`, `tools/call`, and the
  `notifications/initialized` handshake.
- The API persists server configurations (command, args, env) in PostgreSQL and
  holds live connections in memory via `McpServerManager`.
- The UI (Settings → MCP servers) lists servers, their connection status, and
  their discovered tools, and lets you add, connect, disconnect, and delete
  servers.

## Configuration format

| Field | Meaning |
|---|---|
| `name` | Unique display name |
| `command` | Server executable (e.g. `npx -y @modelcontextprotocol/server-filesystem`) |
| `args` | Arguments passed to the command |
| `env` | Environment variables for the server process |

Environment values are stored server-side and **never** returned by the API
(responses expose only `hasEnv: true`).

## Alignment with DeepSeek Harness

DeepSeek Harness has its own MCP client (`dsh-mcp-client`) configured through
its `cordis.yml` / profiles. The WebGUI does not duplicate that plugin system;
it manages MCP servers at the control-plane level. Surfacing these servers into
the harness's `cordis.yml` is a planned integration step.

## Why not the `@modelcontextprotocol/sdk` package?

The official SDK is dual-published (ESM + CJS) but its `exports` subpaths require
Node16 module resolution, which the CommonJS NestJS backend does not use. The
`mcp` package implements the same wire contract directly for the same reason the
harness adapter does (see docs/agents.md). The protocol is identical.
