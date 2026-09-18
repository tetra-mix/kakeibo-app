# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read AGENTS.md first

`AGENTS.md` is the authoritative reference for setup, tooling, and code-style conventions (import order, Biome/tabs/double-quotes, naming, Zod validation, React/Next patterns). Do not duplicate it here — this file only covers the cross-cutting architecture that requires reading several files to see.

## Commands

```bash
pnpm i                       # install
cp .env.example .env         # env; env.ts fails fast on missing vars
pnpm dev                     # db:up + drizzle generate + migrate + next dev
pnpm test                    # NODE_ENV=test vitest run
pnpm test -- server/routes/finance.test.ts   # single file
pnpm test -- -t "createSecureMessageWorkflow" # single test by name
pnpm lint                    # biome lint --write + eslint --fix + knip
pnpm fmt                     # prettier (md/yml) + biome format
pnpm db:generate|migrate|push|studio
```

Docker is required for `pnpm dev` and for any test that touches the DB (testcontainers spins up `compose.yml`'s `db` service per suite).

## Architecture

### One Hono app behind a Next.js catch-all

`app/api/[[...route]]/route.ts` re-exports every HTTP verb through `hono/vercel`'s `handle(app)`. The whole API is a single Hono app assembled in `server/hono-app.ts` (`.basePath("/api")` + one `.route()` per feature). `server/hono-app.ts` also exports `AppType`, which `lib/api-client.ts` feeds to `hc<AppType>` — so **route signatures are the client's type contract**. Changing a route's response shape immediately retypes every client caller.

Adding a route means: create `server/routes/<name>.ts` using `createHonoApp()`, then mount it in `server/hono-app.ts`. Unmounted routes are invisible to both the API and the typed client.

`server/create-app.ts` is the shared factory: it attaches `r2` (an `aws4fetch` `AwsClient` plus bucket/URL config) and `db` to the context, applies `secureHeaders()` and `authMiddleware`, and installs the `notFound`/`onError` handlers that turn `HTTPException` into `{ error }` JSON. Context typing lives in `server/types/index.ts` (`HonoEnv`); use `Context` from there so `c.get("db")` / `c.get("r2")` / `c.get("user")` stay typed.

### Two auth paths, deliberately separate

- **Session auth** (browser): `authMiddleware` runs globally and sets `user`/`session` to the Better Auth session or `null`. Protected handlers call `getUserOrThrow(c)`, which throws `HTTPException(401)`.
- **API-key auth** (external clients): `apiKeyAuthMiddleware` is mounted only on `server/routes/developer.ts`. It looks up the SHA-hashed key (`server/api-keys.ts`), rejects revoked keys, stamps `lastUsedAt`, and sets `apiKeyUser`/`apiKeyId`. Handlers use `getApiKeyUserOrThrow(c)`.

`server/routes/developer.ts` is a thin API-key-authenticated façade: it **imports the exported use-case functions and Zod schemas from the session routes** (`finance.ts`, `scraps.ts`, `subscriptions.ts`, …) rather than reimplementing logic. When you change business logic in a feature route, export the reusable function and check whether `developer.ts` needs the same behavior — and mirror the change into `docs/developer-api/`, which documents that surface.

### Public read-only mode

`getReadableDataOwner(c)` in `server/routes/public-data-owner.ts` is the gate for anonymous reads. Logged in → `{ user, isReadOnly: false }`. Anonymous → if `IS_PUBLIC_FIRST_USER` is on, it returns the **oldest user** with `isReadOnly: true`, otherwise `{ user: null }`. Feature routes that support sharing (finance, scraps, subscriptions, todos) start with this call and use `toPublicDataOwner` to expose only `{ id, name }`. Rows also carry an `isPrivate` flag that must be filtered out on the read-only path — anything new that reads user data needs to honor both the flag and `isReadOnly`.

### Layered server code (only where it earns its keep)

`server/applications/usecases/`, `server/infrastructure/repositories/` (each with `index.ts` + `interface.ts`), and `server/objects/` hold the layered code — currently push notifications, push subscriptions, files/R2, and secure messages. Most CRUD lives directly in `server/routes/*.ts` as exported helper functions. Follow whichever pattern the neighboring feature uses; don't retrofit layers onto simple CRUD.

R2 access goes through `server/infrastructure/repositories/file` (`createFileRepository`, `createR2ObjectUrl`) with `createBlobFile`/`toUploadedFile` from `server/objects/file.ts` — never construct an `AwsClient` in a route.

### Data layer

`db/schema.ts` holds every table _and_ its `relations()` in one file; `lib/db.ts` exports the `db` client and `Database` type. IDs are UUIDv7 (`uuidv7()` / `lib/uuid.ts`). Money is stored as integer minor units (`amountMinor`), currency is `"JPY"`-only today. Migrations are generated into `db/migrations` — never hand-edit them; change `db/schema.ts` and run `pnpm db:generate`.

### Config as feature flags

`env.ts` validates all env vars with Zod at startup (`config()` is called from `next.config.ts` and `vitest.config.ts`) and `process.exit(1)`s with a readable report on failure. `SKIP_ENV_VALIDATION=true` bypasses it. Several vars are runtime feature flags read through small helpers rather than directly: `lib/auth-settings.ts` (`AUTH_SHOW_LOGIN_BUTTON`, `AUTH_SHOW_SIGNUP_BUTTON`, `AUTH_SIGNUP_ENDPOINT_ENABLED`), `lib/public-data-settings.ts` (`IS_PUBLIC_FIRST_USER`), `lib/site-settings.ts` (site name/description/icon). Use the helpers — they encode the default-on vs default-off behavior.

### Frontend

App Router pages under `app/` are thin; each feature's UI is one large client component in `components/` (`finance-app.tsx`, `scrap-app.tsx`, `subscription-app.tsx`, `todo-app.tsx`) that talks to the API via `apiClient`. `app/@modal/(.)scraps/[id]/page.tsx` is an intercepting parallel route — scrap detail renders as a modal from the list and as a full page (`app/scraps/[id]/page.tsx`) on direct navigation; both share `components/scrap-detail.tsx`, so keep them in sync. `app/scraps/[id]/opengraph-image.tsx` generates OG images.

## Testing

`tests/vitest.helper.ts`'s `setup()` is the standard harness for route tests, called with top-level `await`. It boots a testcontainers Postgres (`tests/db.setup.ts` runs `drizzle-kit push --force` against it), `vi.mock`s `@/lib/db` to point at it, mocks `authMiddleware`, truncates via `drizzle-seed`'s `reset` after each test, and tears the container down in `afterAll`. `createUser()` inserts a fixed user/session and flips the auth mock to authenticated — so an unauthenticated 401 test must run before, or in a separate file from, one that calls `createUser()`.

Because auth middleware is mocked, route tests exercise handler logic and DB behavior, not Better Auth itself. Keep fixtures deterministic (fixed dates and IDs) — inline snapshots are the house style.
