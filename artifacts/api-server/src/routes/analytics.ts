import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, promptsTable, usersTable } from "@workspace/db";
import { eq, and, sql, isNull } from "drizzle-orm";

const router = Router();

// GET /api/analytics — creator dashboard
router.get("/analytics", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  if (!user) { res.status(404).json({ error: "Profile not found. Complete onboarding first." }); return; }

  // All prompts by this author (including private, excluding deleted)
  const prompts = await db.select({
    id: promptsTable.id,
    title: promptsTable.title,
    viewCount: promptsTable.viewCount,
    saveCount: promptsTable.saveCount,
    avgRating: promptsTable.avgRating,
    ratingCount: promptsTable.ratingCount,
    isPublic: promptsTable.isPublic,
    createdAt: promptsTable.createdAt,
  })
    .from(promptsTable)
    .where(and(eq(promptsTable.authorUsername, user.username), isNull(promptsTable.deletedAt)));

  const promptIds = prompts.map(p => p.id);

  let purchaseRows: any[] = [];
  let monthlyRows: any[] = [];

  if (promptIds.length > 0) {
    const idList = sql.join(promptIds.map(id => sql`${id}`), sql`, `);

    const purchaseResult = await db.execute(sql`
      SELECT
        item_id,
        COUNT(*)::int AS purchase_count,
        COALESCE(SUM(price_cents), 0)::int AS revenue_cents
      FROM purchases
      WHERE item_type = 'prompt'
        AND item_id = ANY(ARRAY[${idList}]::int[])
      GROUP BY item_id
    `);
    purchaseRows = purchaseResult.rows as any[];

    const monthlyResult = await db.execute(sql`
      SELECT
        to_char(created_at, 'YYYY-MM') AS month,
        COUNT(*)::int AS purchases,
        COALESCE(SUM(price_cents), 0)::int AS revenue_cents
      FROM purchases
      WHERE item_type = 'prompt'
        AND item_id = ANY(ARRAY[${idList}]::int[])
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `);
    monthlyRows = monthlyResult.rows as any[];
  }

  const purchaseMap: Record<number, { count: number; revenue: number }> = {};
  for (const row of purchaseRows) {
    purchaseMap[Number(row.item_id)] = {
      count: Number(row.purchase_count),
      revenue: Number(row.revenue_cents),
    };
  }

  const enriched = prompts.map(p => ({
    id: p.id,
    title: p.title,
    viewCount: p.viewCount,
    saveCount: p.saveCount,
    avgRating: parseFloat(p.avgRating as any) || 0,
    ratingCount: p.ratingCount,
    isPublic: p.isPublic,
    purchaseCount: purchaseMap[p.id]?.count ?? 0,
    revenueCents: purchaseMap[p.id]?.revenue ?? 0,
  })).sort((a, b) => b.revenueCents - a.revenueCents);

  const totals = {
    totalViews: enriched.reduce((s, p) => s + p.viewCount, 0),
    totalSaves: enriched.reduce((s, p) => s + p.saveCount, 0),
    totalPurchases: enriched.reduce((s, p) => s + p.purchaseCount, 0),
    totalRevenueCents: enriched.reduce((s, p) => s + p.revenueCents, 0),
  };

  res.json({
    prompts: enriched,
    totals,
    monthly: monthlyRows.map(r => ({
      month: r.month,
      purchases: Number(r.purchases),
      revenueCents: Number(r.revenue_cents),
    })),
  });
});

export default router;
