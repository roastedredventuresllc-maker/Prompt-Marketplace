import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent schema migrations. Safe to run on every startup.
 * Uses ADD COLUMN IF NOT EXISTS so they're no-ops after the first run.
 */
export async function runMigrations(): Promise<void> {
  // Per-prompt price override (null = use author's account-level default)
  await db.execute(sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS price_cents INTEGER`);

  // Client-supplied dedup key for create_prompt idempotency
  await db.execute(sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);

  // Unique index: one prompt per (author, idempotency_key), nulls excluded
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS prompts_author_idempotency_key
    ON prompts (author_username, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);
}
