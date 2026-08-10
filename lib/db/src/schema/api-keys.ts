import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  ownerClerkUserId: text("owner_clerk_user_id").notNull(),
  keyHash: text("key_hash").notNull().unique(), // SHA-256 of full raw key — never stored in plain text
  keyPrefix: text("key_prefix").notNull(), // first ~12 chars of raw key for display (e.g. "sk_a1b2c3d4e5")
  name: text("name").notNull().default("Default key"),
  creditsCents: integer("credits_cents").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
