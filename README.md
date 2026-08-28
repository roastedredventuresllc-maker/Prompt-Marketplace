# Prompt Marketplace

pnpm workspace: Vite frontend in `artifacts/prompt-marketplace`, Express API in `artifacts/api-server`.

## Vercel

Import this GitHub repo with **Root Directory** `.`. `vercel.json` sets `framework` to `null` so Vercel does not auto-detect Replit/Vite at the wrong path.

| Setting | Value |
| --- | --- |
| Install | `pnpm install` (honors `.npmrc` and the root `preinstall` guard) |
| Build | `pnpm run build:vercel` |
| Output | `artifacts/prompt-marketplace/dist/public` |
| API | `api/index.mjs` + `api/[...path].mjs` — Express. `/api/*` hits the app. |

Do not use root `pnpm build` on Vercel (that typechecks the whole monorepo, including Replit-only artifacts).

### Environment variables (names only — set values in the Vercel project)

**Build-time (Vite inlines these):**

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL` (optional)

**Runtime:**

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `WHOP_API_KEY`
- `WHOP_PROMPT_PLAN_ID`
- `WHOP_COLLECTION_PLAN_ID`
- `WHOP_COMPANY_ID`
- `PUBLIC_APP_URL` (optional; checkout redirects. Falls back to the request host, then `VERCEL_URL`)
- `WHOP_PRODUCT_ID` (optional)
- `PLATFORM_ADMIN_USERNAMES` (optional)
- `PLATFORM_ADMIN_CLERK_USER_IDS` (optional)

Vercel does not need `REPLIT_DOMAINS` or Replit connector variables. Apply Postgres schema with `pnpm --filter @workspace/db push` against `DATABASE_URL` before serving traffic (not part of `vercel build`).
