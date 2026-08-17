# Contributing

Thanks for your interest in contributing to DeepSeek Harness WebGUI.

## Getting started

1. Fork and clone the repository.
2. Install dependencies and set up the environment:

   ```bash
   pnpm install
   cp .env.example .env
   pnpm --filter @deepseek-harness/database db:push
   ```

3. Run the stack: `pnpm dev`.

## Development workflow

- Branch from `main` and open a pull request with a clear description.
- Run the checks before pushing:

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

- Prefer small, focused changes. Keep agent-runtime-specific code inside the
  adapter packages; never leak runtime details into the UI or business logic.

## Adding an agent runtime

Implement the `AgentAdapter` interface in `packages/agent-sdk` and register the
adapter in `apps/api/src/agents/adapters.ts`. Nothing else should change. See
[docs/agents.md](docs/agents.md).

## Conventions

- TypeScript strict mode, ESLint + Prettier (see `.prettierrc.json`).
- Paths are resolved through `resolveWithinRoot` from `@deepseek-harness/shared`;
  never build filesystem paths by string concatenation.
- Secrets are never logged or returned by the API.
- Follow the package README conventions in `packages/AGENTS.md`-style notes where
  they exist.

## Code of conduct

Be respectful and constructive. This project follows a common-sense,
inclusive code of conduct.
