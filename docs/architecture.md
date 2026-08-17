# Architecture

## High-level flow

```
Browser (Next.js)
   ↓ REST / WebSocket / SSE
NestJS API
   ↓ AgentService → AgentAdapter
DeepSeek Harness Adapter (packages/harness)
   ↓ stdio JSON-RPC (official SDK protocol)
dsh-jsonrpc-agent runtime
   ↓
Cordis plugin runtime (session, agent-loop, tools)
```

The application is a control plane. It manages projects, sessions, terminals,
Git, and MCP configuration, and delegates the actual agent execution to the
official DeepSeek Harness runtime through its public SDK protocol.

## Monorepo layout

| Path | Responsibility |
|---|---|
| `apps/web` | Next.js frontend (app router, Tailwind, Monaco, xterm.js) |
| `apps/api` | NestJS backend (REST controllers + socket.io gateways) |
| `packages/shared` | Types, constants, path-safety, validation, password hashing |
| `packages/database` | Prisma schema + client |
| `packages/agent-sdk` | `AgentAdapter` interface + registry |
| `packages/harness` | DeepSeek Harness adapter over the SDK protocol |
| `packages/terminal` | node-pty terminal manager |
| `packages/git` | Git operations (simple-git) |
| `packages/mcp` | MCP stdio client + manager |
| `packages/ui` | Shared React UI primitives |
| `workers/*` | BullMQ background workers |

## Key abstractions

### AgentAdapter

```ts
interface AgentAdapter {
  id: string;
  name: string;
  detect(): Promise<RuntimeInfo>;
  startSession(options: AgentSessionOptions): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<AgentStatus>;
  streamEvents(sessionId: string): AsyncIterable<AgentEvent>;
}
```

Adding a new runtime (Claude Code, Codex, OpenHands) means implementing this
interface and registering it — no other code changes.

### AgentEvent

A normalized event union (`message`, `message_delta`, `tool_call`,
`tool_result`, `file_changed`, `command`, `status`, `approval_request`,
`approval_result`, `plan`, `task_update`, `subagent`, `error`, `session_started`,
`session_ended`). The frontend renders these uniformly regardless of runtime.

### SandboxManager

```ts
interface SandboxManager {
  create(options: SandboxOptions): Promise<SandboxInfo>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  exec(id: string, command: string): Promise<ExecResult>;
}
```

`DockerSandboxManager` is the initial implementation.

## Data flow (realtime)

Agent events flow: runtime → adapter (`session.event`/`session.status`
notifications) → normalized `AgentEvent` → `AgentService` EventEmitter →
socket.io `agent:event` → browser. Terminal data flows: node-pty → Terminal
manager → socket.io `terminal:output` → xterm.js.

## Persistence

PostgreSQL (Prisma) stores WebGUI-owned state: users, projects, sessions,
messages, events, tasks, terminal sessions, MCP configs, git operations, and
audit logs. The harness's own session log (JSONL) is authoritative for agent
state; the WebGUI mirrors only what it needs for its UI.
