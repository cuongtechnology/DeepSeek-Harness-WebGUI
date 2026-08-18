# DeepSeek Harness Integration

This document describes exactly how the WebGUI integrates with the official
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## What DeepSeek Harness is

DeepSeek Harness (`dsh`) is an open-source, **plugin-based** agent harness built
on the [Cordis](https://github.com/cordiverse/cordis) kernel — "everything is a
plugin." It is ESM, runs on Node >= 22.19, and is MIT-licensed. It ships:

- a CLI (`@deepseek-ai/dsh`): `dsh web` (browser UI), `dsh --profile headless "task"`, interactive TUI;
- an **SDK** (`@deepseek-ai/dsh-sdk-client` + `-protocol`) that drives an
  unattended runtime over stdio JSON-RPC;
- an ACP (Agent Client Protocol) server for automation.

## The integration surface

The WebGUI drives the harness through the **official SDK wire protocol** — the
same interface the upstream TypeScript and Python SDKs use. It spawns the
`dsh-jsonrpc-agent` runtime binary and speaks JSON-RPC 2.0 over newline-delimited
stdio.

Requests:

| Method | Params | Result |
|---|---|---|
| `initialize` | `{ cwd, provider, model, maxTokens? }` | `{ serverInfo: { name, version } }` |
| `session/prompt` | `{ sessionId, contentBlocks }` | `{ messageId }` |
| `shutdown` | — | `{}` |

Notifications (server → client):

| Method | Payload |
|---|---|
| `session.event` | `{ sessionId, event: SessionEvent }` |
| `session.status` | `{ sessionId, status: 'idle' \| 'running' }` |
| `subagent.started` | `{ parentSessionId, childSessionId }` |
| `subagent.finished` | `{ provider, agentId, parentSessionId, childSessionId, status, stopReason, lastAssistantMessage? }` |

`SessionEvent` is a discriminated union (`assistant/chunk`, `assistant/message`,
`user/message`, `tool/call`, `tool/result`, `todo/write`, `approval/asked`,
`approval/decided`, `command/run`, `turn/start`, `step/start`, …). The adapter
normalizes these into the WebGUI `AgentEvent` model.

## Why not the npm SDK client?

The upstream `@deepseek-ai/dsh-sdk-client` is ESM-only and pre-release
(`0.0.1-rc.1`); the NestJS backend is CommonJS. The `packages/harness` package
therefore implements the same wire protocol directly (it is small, stable, and
fully documented upstream), so the WebGUI is robust to the upstream's rapid
pre-release churn while speaking the exact official contract. The shapes mirror
upstream 1:1. If the SDK client stabilizes with CJS support, the adapter can
swap to it without touching the rest of the application.

## Configuration

```env
DEEPSEEK_HARNESS_COMMAND=dsh-jsonrpc-agent   # runtime executable (default)
DEEPSEEK_HARNESS_ARGS=
DEEPSEEK_HARNESS_PROVIDER=deepseek-official
DEEPSEEK_HARNESS_MODEL=deepseek-v4-flash
DEEPSEEK_HARNESS_MAX_TOKENS=
DEEPSEEK_HARNESS_TIMEOUT_MS=300000
DEEPSEEK_HARNESS_KILL_MS=3000
DEEPSEEK_HARNESS_INSTALL_METHOD=pip        # on-demand install: pip | source
DEEPSEEK_HARNESS_INSTALL_COMMAND=          # optional install-command override
```

The runtime reads `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DSH_*` variables
from its inherited environment. The adapter sets `DSH_CWD` and `DSH_MODEL` per
workspace and passes the rest through unchanged.

## Obtaining the runtime

The `dsh-jsonrpc-agent` binary is a single-file Node executable:

- built from an upstream checkout via `scripts/build-exe-for-python-sdk.ts`, or
- shipped in the `deepseek-harness-runtime-bin` Python wheel, or
- run from source as `node runtime/node/node_modules/@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/packaged-bin.js`.

The runtime always requires a Cordis configuration (`$DSH_CORDIS_CONFIG` or an
argv positional); the zero-config path injects the upstream default config.

### On-demand installation

When the runtime is missing, `detect()` reports `installable` and the settings
UI offers to install it — **only after the user consents**; the WebGUI never
installs anything silently. Two verified methods are supported:

- `pip` (default) — `python3 -m pip install deepseek-harness-sdk`, which pulls
  the `deepseek-harness-runtime-bin` platform wheel bundling the single-file
  executable and the default `cordis.yml`. The installer locates both via the
  `deepseek_harness_runtime` module and applies them to the running adapter
  (no restart required).
- `source` — clone `deepseek-ai/deepseek-harness`, `pnpm install`, then
  `pnpm exec tsx scripts/build-exe-for-python-sdk.ts` (needs Node >= 22.19 and
  a build toolchain), producing `dist-exe/dsh-jsonrpc-agent-pkg-<platform>-<arch>`.

`DEEPSEEK_HARNESS_INSTALL_METHOD` sets the default method and
`DEEPSEEK_HARNESS_INSTALL_COMMAND` overrides the exact command. `npm i -g
@deepseek-ai/dsh` is intentionally **not** a method: it installs only the `dsh`
CLI, not the `dsh-jsonrpc-agent` runtime.

## Session model

The SDK uses "one runtime, many sessions": one `dsh-jsonrpc-agent` process is
kept **per workspace**, and agent sessions within that workspace share it. A
session goes `running` → `idle` around each turn; it is long-lived and does not
"end" until the runtime is shut down. The WebGUI mirrors this:

- `session.status` `running`/`idle` map to the WebGUI `running`/`idle` states;
- stopping a session stops the workspace runtime (the wire protocol has no
  per-turn cancel), which also stops sibling sessions in that workspace.

## Limitations

- No per-turn cancellation in the SDK protocol (stop = stop the runtime).
- Fine-grained status ("thinking") is not emitted by the wire protocol; the UI
  infers activity from streaming chunks and tool calls.
- The SDK runtime composition ships without an approval UI, so harness-internal
  approvals are not surfaced; the WebGUI's approval gate covers its own command
  execution, and the `approval_request` event path is ready for future runtimes.
- **No reverse control channel.** The wire protocol defines exactly three
  requests — `initialize`, `session/prompt`, `shutdown` (verified against
  `@deepseek-ai/dsh-sdk-protocol` and the runtime server's `handleRequest`).
  There is no approval-response, ask-user-answer, or interrupt request, so:
  - `approval/asked` cards in the UI are **observed state only** — the runtime
    resolves approvals through its own composition (e.g. a `danger-full-access`
    preset never asks), and the adapter declares
    `supportsApprovalResponses = false` so the UI hides the allow/deny buttons;
  - `ask_user_question` cannot be answered from the WebGUI (no user-questions
    wire channel);
  - the only interrupt is `stopSession`, which shuts down the workspace runtime
    (stopping sibling sessions in that workspace).

## Adding a new runtime

Implement `AgentAdapter` (see `packages/agent-sdk`) and register it in
`apps/api/src/agents/adapters.ts`. Do not import DeepSeek-specific code outside
`packages/harness`.
