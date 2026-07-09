# Prompt Marketplace

A dark, futuristic marketplace where AI creators publish categorized prompt libraries. Robinhood-inspired design: near-black backgrounds, electric green accents, and data-forward layouts.

## Run & Operate

- `pnpm --filter @workspace/prompt-marketplace run dev` — frontend (served at `/`)
- `pnpm --filter @workspace/api-server run dev` — API server (served at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS + Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema (categories, users, prompts, libraries, saves)
- `artifacts/api-server/src/routes/` — Express route handlers (categories, users, prompts, libraries, stats)
- `artifacts/prompt-marketplace/src/pages/` — All frontend pages
- `artifacts/prompt-marketplace/src/index.css` — Dark-first theme tokens (green accent, near-black base)

## Pages

- `/` — Home: hero, trending prompts, featured creators, stats ticker
- `/explore` — Browse with search, category filter, sort
- `/prompt/:id` — Prompt detail with copy + save
- `/profile/:username` — Creator profile with prompts + libraries tabs
- `/library/:id` — Curated library detail
- `/onboarding` — 3-step creator profile setup (username → categories → bio)
- `/create` — Publish a new prompt

## Architecture decisions

- Contract-first OpenAPI: spec gates codegen which gates frontend hooks — never hand-write API types
- No auth system: username is passed as a field in requests; profiles are self-managed
- Visibility: public/private toggle on prompts and libraries; `GET /prompts/:id` enforces `isPublic`
- Save count is denormalized on the prompts table for fast sorting; the `saves` table tracks per-user state

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any `openapi.yaml` change, run `pnpm --filter @workspace/api-spec run codegen` before touching frontend code
- The DB schema uses array columns (`text[]`) for user categories and prompt tags — Drizzle handles these natively
- Query params of `"null"` string are normalized to `undefined` server-side before Zod parsing (see `prompts.ts`)
