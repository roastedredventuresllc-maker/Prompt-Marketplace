import { Router, type IRouter } from "express";
import { db, subcategoriesTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories/:slug/subcategories", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  if (!slug || typeof slug !== "string" || slug.length === 0) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug));

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const subcategories = await db
    .select()
    .from(subcategoriesTable)
    .where(eq(subcategoriesTable.categoryId, category.id));

  res.json(
    subcategories.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
      slug: s.slug,
      description: s.description,
    })),
  );
});

export default router;
