import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const savesTable = pgTable("saves", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  promptId: integer("prompt_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
