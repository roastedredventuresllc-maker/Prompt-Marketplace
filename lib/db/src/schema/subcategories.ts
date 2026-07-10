import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subcategoriesTable = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const insertSubcategorySchema = createInsertSchema(subcategoriesTable).omit({ id: true });
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategoriesTable.$inferSelect;
