import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, promptsTable, ratingsTable } from "@workspace/db";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

const router = Router();

// GET /api/prompts/:id/ratings
router.get("/prompts/:id/ratings", async (req, res): Promise<void> => {
  const promptId = parseInt(req.params.id, 10);
  if (isNaN(promptId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { userId: clerkUserId } = getAuth(req);

  const [ratingRows, promptRow] = await Promise.all([
    db.select().from(ratingsTable)
      .where(eq(ratingsTable.promptId, promptId))
      .orderBy(desc(ratingsTable.createdAt))
      .limit(50),
    db.select({ avgRating: promptsTable.avgRating, ratingCount: promptsTable.ratingCount })
      .from(promptsTable)
      .where(and(eq(promptsTable.id, promptId), isNull(promptsTable.deletedAt)))
      .then(rows => rows[0]),
  ]);

  const userRating = clerkUserId
    ? (ratingRows.find(r => r.clerkUserId === clerkUserId)?.rating ?? null)
    : null;

  res.json({
    ratings: ratingRows.map(r => ({
      id: r.id,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      isOwn: r.clerkUserId === clerkUserId,
    })),
    avg: parseFloat(promptRow?.avgRating as any) || 0,
    count: promptRow?.ratingCount ?? 0,
    userRating,
  });
});

// POST /api/prompts/:id/rate
router.post("/prompts/:id/rate", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const promptId = parseInt(req.params.id, 10);
  if (isNaN(promptId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { rating, review } = req.body;
  const ratingInt = parseInt(rating, 10);
  if (!ratingInt || ratingInt < 1 || ratingInt > 5) {
    res.status(400).json({ error: "rating must be an integer 1–5" }); return;
  }

  const [prompt] = await db.select({ id: promptsTable.id })
    .from(promptsTable)
    .where(and(eq(promptsTable.id, promptId), isNull(promptsTable.deletedAt)));
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  // Upsert (insert or update on conflict)
  await db.execute(sql`
    INSERT INTO ratings (prompt_id, clerk_user_id, rating, review, updated_at)
    VALUES (${promptId}, ${clerkUserId}, ${ratingInt}, ${review ?? null}, NOW())
    ON CONFLICT (prompt_id, clerk_user_id)
    DO UPDATE SET
      rating = EXCLUDED.rating,
      review = EXCLUDED.review,
      updated_at = NOW()
  `);

  // Recompute denormalized avg + count on the prompt row
  await db.execute(sql`
    UPDATE prompts SET
      avg_rating = (
        SELECT COALESCE(AVG(rating::numeric), 0)
        FROM ratings WHERE prompt_id = ${promptId}
      ),
      rating_count = (
        SELECT COUNT(*)::int FROM ratings WHERE prompt_id = ${promptId}
      )
    WHERE id = ${promptId}
  `);

  const [updated] = await db
    .select({ avgRating: promptsTable.avgRating, ratingCount: promptsTable.ratingCount })
    .from(promptsTable)
    .where(eq(promptsTable.id, promptId));

  res.json({
    ok: true,
    avg: parseFloat(updated?.avgRating as any) || 0,
    count: updated?.ratingCount ?? 0,
  });
});

export default router;
