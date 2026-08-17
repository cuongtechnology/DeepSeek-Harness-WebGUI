# Security Policy

DeepSeek Harness WebGUI executes code and shell commands on your behalf, so
security is treated as a first-class requirement. This document describes how to
report vulnerabilities and the project's security posture.

## Reporting a vulnerability

Do **not** open a public issue for a security vulnerability. Instead, report it
privately to the maintainers. We will acknowledge within 48 hours and aim to
release a fix within 7 days, coordinated with you.

## Security model

The WebGUI is designed for **self-hosted, single-tenant or trusted-team**
deployments. Its boundaries are:

- **Authentication** — email/password with scrypt-hashed passwords and httpOnly,
  SameSite session cookies (JWT).
- **Authorization** — every resource is scoped to the authenticated user;
  projects, sessions, terminals, and files are ownership-checked.
- **Path safety** — all filesystem access is funnelled through
  `resolveWithinRoot`, which rejects `..` traversal. The browser cannot reach
  host paths outside a project workspace.
- **Command execution** — terminal and sandbox commands run inside a project
  workspace (and, optionally, a Docker sandbox), never in an unrestricted host
  context.
- **Secrets** — environment-variable secrets are never returned by the API or
  written to logs.
- **Approvals** — permission categories (shell, filesystem, network, git,
  package install) gate sensitive actions behind allow/ask/deny policies.

## Known limitations

- The **Docker sandbox** bind-mounts the project workspace and, when the Docker
  socket is exposed to the API container, the container can talk to the host
  Docker daemon. Do not expose the socket to untrusted tenants.
- The integrated **terminal** runs as a child of the API process in the project
  workspace; it is not yet namespaced or `seccomp`-restricted. Use the Docker
  sandbox for stronger isolation.
- Permission policies are currently in-memory (they reset on restart); see
  [docs/security.md](docs/security.md) for the roadmap.

Please report any weakness you find — we take these seriously.
