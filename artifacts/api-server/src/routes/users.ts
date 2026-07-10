import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, promptsTable, librariesTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  CreateUserBody,
  CreateUserResponse,
  GetFeaturedCreatorsResponse,
  GetUserProfileResponse,
  UpdateUserProfileBody,
  UpdateUserProfileResponse,
  GetUserProfileParams,
  UpdateUserProfileParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildUserResponse(user: typeof usersTable.$inferSelect) {
  const [promptCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.authorUsername, user.username));

  const [libraryCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(librariesTable)
    .where(eq(librariesTable.authorUsername, user.username));

  const [totalSavesResult] = await db
    .select({ total: sql<number>`coalesce(sum(${promptsTable.saveCount}), 0)::int` })
    .from(promptsTable)
    .where(eq(promptsTable.authorUsername, user.username));

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    categories: user.categories ?? [],
    orgType: user.orgType ?? "individual",
    orgName: user.orgName ?? null,
    promptCount: promptCountResult?.count ?? 0,
    libraryCount: libraryCountResult?.count ?? 0,
    totalSaves: totalSavesResult?.total ?? 0,
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /users/me — requires Clerk auth
router.get("/users/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, userId));

  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const userResponse = await buildUserResponse(user);
  res.json(GetUserProfileResponse.parse(userResponse));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Always derive clerkUserId from the authenticated session — never trust client input
  const { userId: authUserId } = getAuth(req);

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: authUserId ?? null,
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      bio: parsed.data.bio ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      categories: parsed.data.categories ?? [],
      orgType: (parsed.data as any).orgType ?? "individual",
      orgName: (parsed.data as any).orgName ?? null,
    })
    .returning();

  const userResponse = await buildUserResponse(user);
  res.status(201).json(CreateUserResponse.parse(userResponse));
});

router.get("/users/featured", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "8"), 10);
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(isNaN(limit) ? 8 : limit);

  const results = await Promise.all(users.map(buildUserResponse));
  // Sort by totalSaves descending for featured ranking
  results.sort((a, b) => b.totalSaves - a.totalSaves);
  res.json(GetFeaturedCreatorsResponse.parse(results));
});

router.get("/users/:username", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const params = GetUserProfileParams.safeParse({ username: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid username" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, params.data.username));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const userResponse = await buildUserResponse(user);
  // Include ownerClerkUserId so the frontend can check firm ownership
  res.json({ ...GetUserProfileResponse.parse(userResponse), ownerClerkUserId: user.ownerClerkUserId ?? null });
});

router.patch("/users/:username", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const params = UpdateUserProfileParams.safeParse({ username: raw });
  if (!params.success) { res.status(400).json({ error: "Invalid username" }); return; }

  // Must be authenticated
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Verify the caller owns this profile (by clerkUserId or ownerClerkUserId for firms)
  const [target] = await db.select().from(usersTable).where(eq(usersTable.username, params.data.username));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.clerkUserId !== userId && target.ownerClerkUserId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Pull extra fields directly from body (not in generated schema)
  const body = req.body as Record<string, any>;

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.categories !== undefined) updates.categories = parsed.data.categories;
  // orgType and orgName are not in the generated schema, read from raw body
  if (body.orgType !== undefined) updates.orgType = body.orgType;
  if (body.orgName !== undefined) updates.orgName = body.orgName || null;
  // Username change — check for conflicts
  if (body.username !== undefined && body.username !== params.data.username) {
    const newUsername = String(body.username).toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,29}$/.test(newUsername)) {
      res.status(400).json({ error: "Username must be 2-30 characters: letters, numbers, _ or -" }); return;
    }
    const [conflict] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, newUsername));
    if (conflict) { res.status(409).json({ error: "Username already taken" }); return; }
    updates.username = newUsername;
  }

  let user: typeof usersTable.$inferSelect;
  try {
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.username, params.data.username)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    user = updated;
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
    throw err;
  }

  // Cascade username change to authored prompts and libraries
  if (updates.username && updates.username !== params.data.username) {
    await db.update(promptsTable).set({ authorUsername: updates.username }).where(eq(promptsTable.authorUsername, params.data.username));
    await db.update(librariesTable).set({ authorUsername: updates.username }).where(eq(librariesTable.authorUsername, params.data.username));
  }

  const userResponse = await buildUserResponse(user);
  res.json(UpdateUserProfileResponse.parse(userResponse));
});

export default router;
