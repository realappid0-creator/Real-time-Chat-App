# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `DATABASE_POOL_MAX` — PostgreSQL connections per API instance (defaults to 5; maximum 20). Idle connections close after 30 seconds.
- Signed-in users are signed out after 30 minutes without sending or receiving a chat message. Set `VITE_INACTIVITY_TIMEOUT_MINUTES` to override this duration.
- Web Push requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the API server. Generate a key pair with `pnpm --filter @workspace/api-server exec web-push generate-vapid-keys`; keep the private key in deployment secrets and never commit it. Use a `mailto:` contact for `VAPID_SUBJECT`.
- Apply `lib/db/migrations/0001_chat_push_subscriptions.sql` once in the Supabase SQL Editor before deploying Web Push. Add all three VAPID variables to the Render service environment.
- New users are offered message-notification permission during profile onboarding. Browsers require a user gesture before showing the native permission prompt; users who skip onboarding can enable it later by revisiting onboarding only if their profile is incomplete.
- Local backend startup and schema push load `DATABASE_URL` from the root `.env`; deployments should provide it as a secret. When using the Supabase CA certificate, provide `supabase-ca.crt` at the repository root (or install its CA in the runtime trust store).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
