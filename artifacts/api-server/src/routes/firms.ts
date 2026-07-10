import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";

const router: Router = Router();

function canManageFirm(firm: typeof usersTable.$inferSelect, userId: string): boolean {
  if (firm.ownerClerkUserId === userId) return true;
  if ((firm.adminClerkUserIds ?? []).includes(userId)) return true;
  return false;
}

async function buildFirmResponse(f: typeof usersTable.$inferSelect) {
  // Resolve admin Clerk IDs to usernames for display
  const adminIds = f.adminClerkUserIds ?? [];
  let adminUsernames: { clerkUserId: string; username: string; displayName: string }[] = [];
  if (adminIds.length > 0) {
    const adminUsers = await db.select({
      clerkUserId: usersTable.clerkUserId,
      username: usersTable.username,
      displayName: usersTable.displayName,
    }).from(usersTable).where(
      sql`${usersTable.clerkUserId} = ANY(${sql.raw("'{" + adminIds.map(id => id.replace(/'/g, "''")).join(",") + "}'")}::text[])`
    );
    adminUsernames = adminUsers.map(u => ({
      clerkUserId: u.clerkUserId ?? "",
      username: u.username,
      displayName: u.displayName,
    }));
  }

  return {
    id: f.id,
    username: f.username,
    displayName: f.displayName,
    orgName: f.orgName,
    bio: f.bio,
    categories: f.categories ?? [],
    avatarUrl: f.avatarUrl,
    promptPriceCents: f.promptPriceCents,
    collectionPriceCents: f.collectionPriceCents,
    adminClerkUserIds: adminIds,
    admins: adminUsernames,
  };
}

/* GET /api/firms/mine — list firms the user owns OR administers */
router.get("/firms/mine", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const firms = await db.select().from(usersTable).where(
    or(
      eq(usersTable.ownerClerkUserId, userId),
      sql`${userId} = ANY(${usersTable.adminClerkUserIds})`
    )
  );

  const results = await Promise.all(firms.map(buildFirmResponse));
  res.json(results);
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

    res.status(201).json(await buildFirmResponse(firm));
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
    throw e;
  }
});

/* PATCH /api/firms/:username — update a firm (owner or admin) */
router.patch("/firms/:username", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.params as { username: string };
  const [firm] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!firm || !firm.ownerClerkUserId) { res.status(404).json({ error: "Firm not found" }); return; }
  if (!canManageFirm(firm, userId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, bio, categories, promptPriceCents, collectionPriceCents } = req.body as {
    name?: string; bio?: string; categories?: string[];
    promptPriceCents?: number; collectionPriceCents?: number;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) { updates.displayName = name.trim(); updates.orgName = name.trim(); }
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (categories !== undefined) updates.categories = categories;
  if (typeof promptPriceCents === "number" && promptPriceCents > 0) updates.promptPriceCents = promptPriceCents;
  if (typeof collectionPriceCents === "number" && collectionPriceCents > 0) updates.collectionPriceCents = collectionPriceCents;

  const [updated] = await db.update(usersTable).set(updates)
    .where(eq(usersTable.username, username))
    .returning();

  if (!updated) { res.status(404).json({ error: "Firm not found" }); return; }
  res.json(await buildFirmResponse(updated));
});

/* POST /api/firms/:username/admins — add an admin by username */
router.post("/firms/:username/admins", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.params as { username: string };
  const [firm] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!firm || !firm.ownerClerkUserId) { res.status(404).json({ error: "Firm not found" }); return; }

  // Only the owner can manage admins
  if (firm.ownerClerkUserId !== userId) { res.status(403).json({ error: "Only the firm owner can manage admins" }); return; }

  const { adminUsername } = req.body as { adminUsername?: string };
  if (!adminUsername?.trim()) { res.status(400).json({ error: "adminUsername is required" }); return; }

  // Look up the user to admin by username
  const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername.trim()));
  if (!adminUser || !adminUser.clerkUserId) { res.status(404).json({ error: "User not found" }); return; }

  // Don't add the owner as admin
  if (adminUser.clerkUserId === firm.ownerClerkUserId) {
    res.status(400).json({ error: "Owner is already an admin" }); return;
  }

  const existing = (firm.adminClerkUserIds ?? []);
  if (existing.includes(adminUser.clerkUserId)) {
    res.json(await buildFirmResponse(firm)); return; // already added
  }

  const [updated] = await db.update(usersTable)
    .set({ adminClerkUserIds: [...existing, adminUser.clerkUserId] })
    .where(eq(usersTable.username, username))
    .returning();

  res.json(await buildFirmResponse(updated));
});

/* DELETE /api/firms/:username/admins/:adminClerkUserId — remove an admin */
router.delete("/firms/:username/admins/:adminClerkUserId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username, adminClerkUserId } = req.params as { username: string; adminClerkUserId: string };
  const [firm] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!firm || !firm.ownerClerkUserId) { res.status(404).json({ error: "Firm not found" }); return; }

  // Owner can remove any admin; admins can remove themselves
  if (firm.ownerClerkUserId !== userId && adminClerkUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [updated] = await db.update(usersTable)
    .set({ adminClerkUserIds: (firm.adminClerkUserIds ?? []).filter(id => id !== adminClerkUserId) })
    .where(eq(usersTable.username, username))
    .returning();

  res.json(await buildFirmResponse(updated));
});

/* DELETE /api/firms/:username — delete a firm (owner only) */
router.delete("/firms/:username", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.params as { username: string };
  const [firm] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!firm || !firm.ownerClerkUserId) { res.status(404).json({ error: "Firm not found" }); return; }
  if (firm.ownerClerkUserId !== userId) { res.status(403).json({ error: "Only the owner can delete a firm" }); return; }

  await db.delete(usersTable).where(eq(usersTable.username, username));
  res.json({ deleted: true });
});

export default router;
