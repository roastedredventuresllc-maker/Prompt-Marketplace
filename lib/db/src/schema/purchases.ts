import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  itemType: text("item_type").notNull(), // "prompt" | "library"
  itemId: integer("item_id").notNull(),
  whopCheckoutConfigId: text("whop_checkout_config_id"),
  priceCents: integer("price_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
