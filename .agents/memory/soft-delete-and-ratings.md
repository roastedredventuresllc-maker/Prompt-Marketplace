---
name: Soft delete, ratings, analytics, sitemap, FTS
description: Non-destructive delete pattern, ratings table, analytics endpoint, sitemap, and full-text search added to Promptly.
---

## Soft delete on prompts
- `deleted_at TIMESTAMP` column added to `prompts` table (nullable; NULL = live).
- ALL queries on `promptsTable` must include `isNull(promptsTable.deletedAt)` in WHERE.
- DELETE routes (REST + MCP + agent) now do `UPDATE prompts SET deleted_at = NOW()` instead of hard delete.
- Library memberships, ratings, and purchases are preserved on soft-deleted prompts.

**Why:** User said "non-destructive — preserve all user work."

**How to apply:** Any new route that queries prompts must add `isNull(promptsTable.deletedAt)`. Any future delete UI must use the soft-delete pattern.

## Ratings table
- `ratings` table: `id, prompt_id (FK), clerk_user_id, rating (1-5), review, created_at, updated_at`.
- UNIQUE constraint on `(prompt_id, clerk_user_id)` — one rating per user per prompt.
- Upsert via raw SQL `ON CONFLICT DO UPDATE` since drizzle doesn't have a clean upsert API.
- `avg_rating` (DECIMAL 3,2) and `rating_count` (INTEGER) denormalized on `prompts` table for fast card display.
- Recomputed via raw SQL after every upsert: `UPDATE prompts SET avg_rating = AVG(...), rating_count = COUNT(...)`.

## Full-text search
- `search_vector TSVECTOR` column on `prompts`, maintained by trigger `prompts_search_trigger` (BEFORE INSERT OR UPDATE).
- GIN index `prompts_search_idx` on `search_vector`.
- Query: `sql\`search_vector @@ plainto_tsquery('english', \${search})\`` in the WHERE clause.
- Generated column approach failed (array_to_string is STABLE not IMMUTABLE) — trigger is the correct pattern.

## Analytics endpoint
- `GET /api/analytics` (Clerk auth required) — returns per-prompt stats + 6-month monthly breakdown.
- Frontend page at `/analytics`, linked from user dropdown menu.

## Sitemap
- `GET /sitemap.xml` mounted at root (not under /api), before Clerk middleware.
- Lists all public non-deleted prompts + all creator profiles.
- Cache-Control: public, max-age=3600.
