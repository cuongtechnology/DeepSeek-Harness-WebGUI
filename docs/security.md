# Security

This project executes code, so its security boundaries matter. This document
covers the implemented protections and the honest limitations.

## Protections

- **Authentication** — email/password, scrypt hashed (`packages/shared`
  `hashPassword`), httpOnly + SameSite session cookie carrying a signed JWT.
  Registration can be disabled with `AUTH_ALLOW_REGISTRATION=false`.
- **Authorization** — every project/session/terminal/file/git/mcp operation is
  scoped to the authenticated user via ownership checks in the service layer.
- **Input validation** — `class-validator` DTOs with `whitelist` +
  `forbidNonWhitelisted`; free-form strings are bounded and control-character
  checked.
- **Rate limiting** — global `@nestjs/throttler` guard.
- **Path traversal protection** — all filesystem access resolves through
  `resolveWithinRoot` (`packages/shared/src/utils/path.ts`), which rejects `..`
  escapes. `../../etc/passwd` is impossible from the browser.
- **Secret protection** — MCP env values and API keys are never returned by the
  API or written to logs.
- **Structured process arguments** — the harness, MCP, and sandbox processes are
  spawned with `spawn`/`execFile` and argument arrays, never shell string
  concatenation (except `docker exec sh -c`, which runs inside the container).
- **Audit logging** — auth, project, session, file, git, sandbox, and approval
  actions are recorded in the `AuditLog` table.
- **Approval gate** — permission categories (`shell`, `filesystem`, `network`,
  `git`, `package_install`) with `always_allow` / `ask` / `deny` policies.

## Command execution boundary

The integrated terminal and Git operations run as children of the API process
with `cwd` pinned to the project workspace. The optional **Docker sandbox**
runs the workspace in a container (unprivileged, optional `--network none`).
Neither path is a full virtualization boundary by itself.

## Known limitations

1. **Docker socket exposure** — the sandbox feature requires the Docker socket
   to be mounted into the API/worker container. A compromised container could
   then control the host Docker daemon. Do not expose the socket in multi-tenant
   deployments; prefer a remote Docker context or gVisor/Firecracker.
2. **Terminal isolation** — the integrated terminal is a plain `node-pty` child,
   not namespaced or seccomp-restricted. Use the Docker sandbox for untrusted
   workloads.
3. **Permission policies are in-memory** — per-project policy overrides reset on
   restart. Persisting them (and per-tool policies) is on the roadmap.
4. **Single-tenant assumption** — the system is designed for trusted-team
   self-hosting, not hostile multi-tenancy.

## Reporting

See [SECURITY.md](../SECURITY.md).
