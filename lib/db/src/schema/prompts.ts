import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promptsTable = pgTable("prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  categoryId: integer("category_id").notNull(),
  tags: text("tags").array().notNull().default([]),
  authorUsername: text("author_username").notNull(),
  saveCount: integer("save_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPromptSchema = createInsertSchema(promptsTable).omit({ id: true, saveCount: true, viewCount: true, createdAt: true, updatedAt: true });
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof promptsTable.$inferSelect;
