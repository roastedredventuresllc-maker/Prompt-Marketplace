import { Router, type IRouter } from "express";
import { db, promptsTable, usersTable, librariesTable, savesTable, categoriesTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { GetMarketplaceStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const [promptCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.isPublic, true));

  const [creatorCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  const [saveCount] = await db
    .select({ total: sql<number>`coalesce(sum(save_count), 0)::int` })
    .from(promptsTable);

  const [libraryCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(librariesTable)
    .where(eq(librariesTable.isPublic, true));

  const categoryCounts = await db
    .select({ categoryId: promptsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.isPublic, true))
    .groupBy(promptsTable.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const topCategories = await Promise.all(
    categoryCounts.map(async ({ categoryId, count }) => {
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId));
      return cat ? { ...cat, promptCount: count } : null;
    }),
  );

  const result = {
    totalPrompts: promptCount?.count ?? 0,
    totalCreators: creatorCount?.count ?? 0,
    totalSaves: saveCount?.total ?? 0,
    totalLibraries: libraryCount?.count ?? 0,
    topCategories: topCategories.filter(Boolean),
  };

  res.json(GetMarketplaceStatsResponse.parse(result));
});

export default router;
