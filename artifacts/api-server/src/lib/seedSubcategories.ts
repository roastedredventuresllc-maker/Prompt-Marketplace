import { db } from "@workspace/db";
import { subcategoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import subcategoriesData from "./seed-data/subcategories.json";

export async function seedSubcategories(): Promise<void> {
  for (const sub of subcategoriesData as Array<{
    id: number;
    categoryId: number;
    name: string;
    slug: string;
    description: string;
  }>) {
    await db
      .insert(subcategoriesTable)
      .values(sub)
      .onConflictDoUpdate({
        target: subcategoriesTable.id,
        set: {
          categoryId: sql`excluded.category_id`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          // slug is left unchanged to avoid breaking existing links
        },
      });
  }
}
