# Vercel (repo root — full marketplace)

**Do not set Root Directory to `artifacts/api-server`.** That produces a slug like `prompt-marketplace-api-server-git-main-…` and deploys naked Express with no Vite UI.

Create a **new** Vercel project from this GitHub repo (or change the existing project’s Root Directory). Use this PR branch `cursor/gate-prompt-content-69b2`, not a root-directory of `artifacts/api-server` on `main`.

## One project (preferred)

A single Vercel project **can** serve both the frontend and the API when Root Directory is the **repository root**.

| Setting | Value |
| --- | --- |
| Framework | Other (`vercel.json` sets `framework: null`) |
| Root Directory | `.` (empty / repository root). **Not** `artifacts/api-server`. **Not** `artifacts/prompt-marketplace`. |
| Install Command | `pnpm install` |
| Build Command | `pnpm --filter @workspace/prompt-marketplace run build && pnpm --filter @workspace/api-server run build` |
| Output Directory | `artifacts/prompt-marketplace/dist/public` |
| Node | `22.x` (`package.json` `engines` + `packageManager: pnpm@10.33.3`) |
| Rewrites | `/api/:path*` → `/api?__path=:path*` (Express). SPA fallback `/:path*` → `/index.html`. |

`api/index.ts` re-exports the pre-bundled Express handler (`dist/vercelHandler.mjs`). The Vite step is required; the api-server step is so Vercel does not compile the TS workspace graph (and does not need `DATABASE_URL`) while packing `/api`. No `@replit/connectors-sdk`.

Do not use root `pnpm build` (typechecks Replit-only packages).

Env names: see README.

## Two-project fallback

Use this only if the single-project Express function cannot be compiled on Vercel.

1. **API** — Root Directory `artifacts/api-server` (this is the import that created `…-api-server-git-main-…`). Express only. No marketplace UI.
2. **Frontend** — Root Directory `.` with the install/build/output above. Change the `/api/:path*` rewrite destination to the API project origin, e.g. `https://<api-project>.vercel.app/api/:path*`. Set `PUBLIC_APP_URL` on the API to the frontend origin.

Same-origin `/api` (one project) is the intended production shape.
