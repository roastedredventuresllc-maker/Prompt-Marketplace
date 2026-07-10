import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/** GET /settings/pricing — returns current user's pricing */
router.get("/settings/pricing", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, userId));
  if (!user) { res.status(404).json({ error: "Profile not found" }); return; }

  res.json({
    promptPriceCents: user.promptPriceCents,
    collectionPriceCents: user.collectionPriceCents,
    orgType: user.orgType,
    username: user.username,
  });
});

/** PATCH /settings/pricing — update current user's pricing */
router.patch("/settings/pricing", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { promptPriceCents, collectionPriceCents } = req.body as {
    promptPriceCents?: number;
    collectionPriceCents?: number;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof promptPriceCents === "number" && promptPriceCents > 0) updates.promptPriceCents = promptPriceCents;
  if (typeof collectionPriceCents === "number" && collectionPriceCents > 0) updates.collectionPriceCents = collectionPriceCents;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates)
    .where(eq(usersTable.clerkUserId, userId)).returning();
  if (!user) { res.status(404).json({ error: "Profile not found" }); return; }

  res.json({
    promptPriceCents: user.promptPriceCents,
    collectionPriceCents: user.collectionPriceCents,
  });
});

export default router;
