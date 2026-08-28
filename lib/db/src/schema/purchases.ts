import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  itemType: text("item_type").notNull(), // "prompt" | "library" | "credit_topup"
  transactionType: text("transaction_type").notNull().default("purchase"),
  itemId: integer("item_id").notNull(),
  whopCheckoutConfigId: text("whop_checkout_config_id"),
  priceCents: integer("price_cents").notNull(), // gross amount retained for compatibility
  commissionCents: integer("commission_cents").notNull().default(0),
  netCents: integer("net_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("purchases_whop_checkout_config_id_unique")
    .on(table.whopCheckoutConfigId)
    .where(sql`${table.whopCheckoutConfigId} IS NOT NULL`),
]);

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
