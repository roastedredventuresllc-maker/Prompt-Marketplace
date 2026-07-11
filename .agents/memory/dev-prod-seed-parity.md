---
name: Dev/prod data parity via startup seed
description: Why demo/seed content (users, prompts, subcategories) must be shipped as idempotent startup seeders rather than one-off SQL, and how to regenerate them from dev.
---

Publishing only runs a **schema** diff against the production database (columns/tables). It never copies row data. Any demo/showcase content created by running ad-hoc SQL against the dev DB will never reach production — production silently drifts further behind every time new demo content is added to dev by hand.

**Why:** this caused production to be missing entire categories' worth of prompts and all the seed firm accounts (Acme Capital, Horizons Tax, Meridian Legal, Open Counsel, etc.) even though dev looked complete, because that content was inserted directly into the dev DB at some point rather than via a seed script.

**How to apply:**
- Any content meant to exist in every environment (canonical categories, subcategories, demo firms/creators, starter prompts) must be created by an idempotent seeder invoked on server startup (see `artifacts/api-server/src/lib/seedCategories.ts`, `seedSubcategories.ts`, `seedPrompts.ts`), not by direct SQL against one environment's DB.
- Seeders must be safe to re-run: upsert-by-stable-id for reference data (categories/subcategories keep explicit numeric `id`s across environments so FK columns like `prompts.subcategoryId` line up), and skip-if-exists (e.g. by unique title/username) for content rows so re-runs don't duplicate or clobber edits.
- To regenerate seed data from the current dev DB (e.g. after adding more demo content by hand), export the relevant tables with `json_agg(row_to_json(...))` via SQL, write the JSON into `artifacts/api-server/src/lib/seed-data/*.json`, and have the seeders read from that JSON. Exclude real user accounts (check `clerk_user_id IS NOT NULL`) from any such export — only synthetic/demo accounts belong in seed data.
- `resolveJsonModule: true` is required in the api-server tsconfig for JSON imports to type-check; esbuild bundles JSON natively so the build step itself doesn't need extra config.
