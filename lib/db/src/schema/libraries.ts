import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const librariesTable = pgTable("libraries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  authorUsername: text("author_username").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const libraryPromptsTable = pgTable("library_prompts", {
  id: serial("id").primaryKey(),
  libraryId: serial("library_id").notNull(),
  promptId: serial("prompt_id").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertLibrarySchema = createInsertSchema(librariesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLibrary = z.infer<typeof insertLibrarySchema>;
export type Library = typeof librariesTable.$inferSelect;
