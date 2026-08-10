import { pgTable, serial, integer, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    rating: integer("rating").notNull(),
    review: text("review"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.promptId, table.clerkUserId)],
);

export type Rating = typeof ratingsTable.$inferSelect;
export type InsertRating = typeof ratingsTable.$inferInsert;
