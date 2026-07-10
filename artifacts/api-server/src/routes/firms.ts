import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: Router = Router();

/* GET /api/firms/mine — list firms owned by the authenticated user */
router.get("/firms/mine", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const firms = await db.select().from(usersTable)
    .where(eq(usersTable.ownerClerkUserId, userId));

  res.json(firms.map(f => ({
    id: f.id,
    username: f.username,
    displayName: f.displayName,
    orgName: f.orgName,
    bio: f.bio,
    categories: f.categories ?? [],
    avatarUrl: f.avatarUrl,
  })));
});

/* POST /api/firms — create a new firm profile */
router.post("/firms", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, username, bio, categories } = req.body as {
    name?: string; username?: string; bio?: string; categories?: string[];
  };
  if (!name?.trim() || !username?.trim()) {
    res.status(400).json({ error: "name and username are required" });
    return;
  }

  try {
    const [firm] = await db.insert(usersTable).values({
      ownerClerkUserId: userId,
      username: username.trim().toLowerCase(),
      displayName: name.trim(),
      orgType: "firm",
      orgName: name.trim(),
      bio: bio?.trim() || null,
      categories: categories ?? [],
    }).returning();

    res.status(201).json({
      id: firm.id,
      username: firm.username,
      displayName: firm.displayName,
      orgName: firm.orgName,
      bio: firm.bio,
      categories: firm.categories,
    });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
    throw e;
  }
});

/* PATCH /api/firms/:username — update a firm you own */
router.patch("/firms/:username", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.params as { username: string };
  const { name, bio, categories } = req.body as { name?: string; bio?: string; categories?: string[] };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) { updates.displayName = name.trim(); updates.orgName = name.trim(); }
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (categories !== undefined) updates.categories = categories;

  const [firm] = await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.username, username), eq(usersTable.ownerClerkUserId, userId)))
    .returning();

  if (!firm) { res.status(404).json({ error: "Firm not found or not yours" }); return; }
  res.json({ id: firm.id, username: firm.username, displayName: firm.displayName, orgName: firm.orgName, bio: firm.bio, categories: firm.categories });
});

/* DELETE /api/firms/:username — delete a firm you own */
router.delete("/firms/:username", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.params as { username: string };
  const [deleted] = await db.delete(usersTable)
    .where(and(eq(usersTable.username, username), eq(usersTable.ownerClerkUserId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Firm not found or not yours" }); return; }
  res.json({ deleted: true });
});

export default router;
