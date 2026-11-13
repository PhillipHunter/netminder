# NetMinder Agent Guide

## Workspaces & Module Organization
- `server.ts` boots the Bun/Elysia stack, wires in `@netminder/api`, serves the SPA from `@netminder/client/index.html`, and calls `initDatabase()` from `@netminder/dal`. Touch this file when adding global middleware, new mounts, or startup checks.
- Bun workspaces live at `api/`, `client/`, `core/`, and `dal/`; shared compiler settings are in `tsconfig.base.json`.
- `api/` is domain-partitioned (`auth`, `nets`, `stations`, `checkins`, `settings`, `users`, `health`, `common`). Each folder houses handlers, schema/contract definitions, and utilities; `api/index.ts` re-exports routes with an `/api` prefix and publishes OpenAPI docs at `/api/openapi`.
- `dal/` contains the SQLite data layer. `dal/db` manages connections, migrations, and schema statements, while sibling folders (`nets/`, `stations/`, `users/`, etc.) expose typed queries. All public DAL entry points are re-exported through `dal/index.ts`.
- `core/` hosts shared domain helpers (encryption, QRZ integration, settings helpers) surfaced via `core/src/index.ts`; import them with `@netminder/core`.
- `client/` is the React SPA. Views live under `pages/`, reusable UI under `components/`, and shared logic under `contexts/`, `hooks/`, `types/`, and `utils/`. Tailwind sources are in `client/css/`, and `client/index.html` is what `server.ts` serves for non-API requests.
- `docs/` holds contributor notes (cleanup plans, API/DAL roadmaps). Persistent SQLite files are created under `data/` (gitignored).

## Elysia & API Contracts
- `server.ts` instantiates a single Elysia app, layers in CORS, response hardening (`onAfterHandle` adds HSTS, CSP, etc.), mounts all API contracts via `@netminder/api`, and finally serves the React SPA fallback. Treat this as the canonical place to register global middleware or additional `.use()` plugins.
- `api/index.ts` wires the domain route groups into one Elysia instance and registers the `@elysiajs/openapi` plugin. Every handler exports both a runtime implementation and a corresponding contract object; the plugin reads that metadata to synthesize the Scalar UI served at `http://localhost:8080/api/openapi`.
- Contracts annotate schemas, tags, descriptions, and error shapes so OpenAPI stays accurate as you evolve handlers. Update those contract objects whenever request/response payloads change to keep the docs in sync.
- `client/src/api.ts` creates a typed `edenTreaty<App>` client. Because `App` comes from the same Elysia router, React code consumes fully inferred request/response types, giving end-to-end type safety from the handler contracts down to component props.

## Development & Tooling
- Run `bun install` once at the repo root to hydrate all workspaces.
- `bun run dev` clears old artifacts, launches Tailwind in watch mode, and starts the Bun server with hot reload on `http://localhost:8080`.
- `bun run tailwind` performs a one-off CSS build; `bun run clean` removes `.dist/` and generated CSS (`client/css/dist.css`).
- Production builds live in `.dist/`: use `bun run build` (optimized) or `bun run build:dev` (debuggable). Native binaries are emitted through `bun run compile`, `bun run compile:applesilicon`, or `bun run compile:linux`.
- Container workflows: `docker-compose up --build` runs the whole stack with a volume-backed database; `bun run docker:build` pushes multi-arch images via Buildx.

## Linting & Type Safety
- Execute `bun run lint` before committing. It runs `tsgo --noEmit` across the root, client, api, core, and dal TypeScript configs, then invokes ESLint (`eslint.config.js`) with `--fix` and fails on warnings.
- Keep imports grouped (external first, then internal) and surface shared code via workspace `index.ts` files so consumers import from `@netminder/*`.
- Use four-space indentation and prefer explicit return types on exported functions to match the existing code style.

## Testing
- Bun’s test runner is available per workspace even though no scripts exist yet. Create specs under folders like `api/__tests__/` or co-locate them with the feature modules; mirror that structure in the client with `client/src/__tests__/`.
- For DAL tests, point `DATABASE_PATH` at `:memory:` or another throwaway location. Document manual verification steps and expected outcomes in PRs until automated coverage is in place.

## Database & Configuration
- `initDatabase()` (from `@netminder/dal`) executes schema statements and migrations on startup. The default SQLite file lives at `data/netminder.sqlite3`; override via `DATABASE_PATH`.
- Environment expectations:
    - `JWT_SECRET` (required outside of local dev; a fallback is only used for convenience)
    - `CONFIG_ENCRYPTION_KEY` (needed to encrypt stored QRZ credentials; optional in development but logged)
    - `PORT` (defaults to `8080`)
    - `NODE_ENV` (defaults to `development`)
- The server relaxes CORS during development and sets security headers (HSTS, CSP, X-Frame-Options, etc.) in production. Adjust `server.ts` if additional global policies are needed.

## Security & Collaboration
- Treat secrets carefully—never commit them. Mirror new configuration keys in `.env.example` and note them in docs.
- Follow the existing commit convention (`scope: imperative change`). Keep PRs focused, include what changed, why, and the manual/automated checks performed, and attach UI screenshots or clips when touching `client/`.
- Call out schema, migration, or auth changes in PR descriptions so reviewers can validate migrations and plan rollbacks if necessary.
