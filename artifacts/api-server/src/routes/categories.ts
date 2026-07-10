import { Router, type IRouter } from "express";
import { db, categoriesTable, promptsTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";
import { ListCategoriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.id));

  const counts = await db
    .select({ categoryId: promptsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.isPublic, true))
    .groupBy(promptsTable.categoryId);

  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

  const result = categories.map((cat) => ({
    ...cat,
    promptCount: countMap.get(cat.id) ?? 0,
  }));

  res.json(ListCategoriesResponse.parse(result));
});

export default router;
