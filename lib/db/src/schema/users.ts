import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  categories: text("categories").array().notNull().default([]),
  orgType: text("org_type").notNull().default("individual"), // "individual" | "firm"
  orgName: text("org_name"), // set when orgType = "firm"
  freePromptsUsed: integer("free_prompts_used").notNull().default(0),
  promptPriceCents: integer("prompt_price_cents").notNull().default(500),
  collectionPriceCents: integer("collection_price_cents").notNull().default(10000),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
