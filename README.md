# Prompt Marketplace

pnpm workspace: Vite frontend in `artifacts/prompt-marketplace`, Express API in `artifacts/api-server`.

## Vercel

**Root Directory must be the repo root (`.`).** Importing `artifacts/api-server` deploys Express alone (slug `prompt-marketplace-api-server-…`) and skips the marketplace UI.

Full settings, rewrites, and the two-project fallback: [VERCEL.md](./VERCEL.md).

| Setting | Value |
| --- | --- |
| Install | `pnpm install` |
| Build | `pnpm --filter @workspace/prompt-marketplace run build && pnpm --filter @workspace/api-server run build` |
| Output | `artifacts/prompt-marketplace/dist/public` |
| API | `api/index.ts` re-exports the pre-bundled Express handler; `/api/:path*` rewrites to it |

Do not use root `pnpm build` on Vercel.

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
