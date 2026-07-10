import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, promptsTable, categoriesTable, subcategoriesTable, usersTable, savesTable, purchasesTable, libraryPromptsTable } from "@workspace/db";
import { eq, sql, desc, ilike, and, inArray } from "drizzle-orm";
import {
  ListPromptsQueryParams,
  ListPromptsResponse,
  CreatePromptBody,
  CreatePromptResponse,
  GetPromptParams,
  GetPromptResponse,
  UpdatePromptBody,
  UpdatePromptParams,
  UpdatePromptResponse,
  DeletePromptParams,
  ToggleSavePromptBody,
  ToggleSavePromptParams,
  ToggleSavePromptResponse,
  GetTrendingPromptsQueryParams,
  GetTrendingPromptsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Returns first ~120 chars as a teaser for gated content */
function truncateContent(content: string): string {
  const snippet = content.replace(/\s+/g, " ").trim().slice(0, 120);
  return snippet.length < content.trim().length ? snippet + "…" : snippet;
}

/** Server-side access check: true if author, purchased, or library-purchased */
async function checkPromptAccess(clerkUserId: string | null, promptId: number): Promise<boolean> {
  if (!clerkUserId) return false;

  // Author always has access (direct account or firm owner)
  const [promptRow] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (promptRow) {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.username, promptRow.authorUsername));
    if (author && (author.clerkUserId === clerkUserId || author.ownerClerkUserId === clerkUserId)) return true;
  }

  // Direct purchase (paid or free)
  const [direct] = await db
    .select()
    .from(purchasesTable)
    .where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, promptId)));
  if (direct) return true;

  // Library purchase covering this prompt
  const libRows = await db
    .select({ libraryId: libraryPromptsTable.libraryId })
    .from(libraryPromptsTable)
    .where(eq(libraryPromptsTable.promptId, promptId));
  if (libRows.length > 0) {
    const [libPurchase] = await db
      .select()
      .from(purchasesTable)
      .where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "library"), inArray(purchasesTable.itemId, libRows.map((l) => l.libraryId))));
    if (libPurchase) return true;
  }

  return false;
}

async function buildPromptResponse(prompt: typeof promptsTable.$inferSelect) {
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, prompt.categoryId));

  const [author] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, prompt.authorUsername));

  let subcategoryName: string | null = null;
  if (prompt.subcategoryId) {
    const [sub] = await db
      .select()
      .from(subcategoriesTable)
      .where(eq(subcategoriesTable.id, prompt.subcategoryId));
    subcategoryName = sub?.name ?? null;
  }

  return {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    description: prompt.description ?? null,
    categoryId: prompt.categoryId,
    categoryName: category?.name ?? "Uncategorized",
    subcategoryId: prompt.subcategoryId ?? null,
    subcategoryName,
    tags: prompt.tags ?? [],
    authorUsername: prompt.authorUsername,
    authorDisplayName: author?.displayName ?? prompt.authorUsername,
    authorAvatarUrl: author?.avatarUrl ?? null,
    authorOrgType: author?.orgType ?? "individual",
    authorOrgName: author?.orgName ?? null,
    saveCount: prompt.saveCount,
    viewCount: prompt.viewCount,
    isPublic: prompt.isPublic,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
  };
}

router.get("/prompts/trending", async (req, res): Promise<void> => {
  const qp = GetTrendingPromptsQueryParams.safeParse(req.query);
  const limit = qp.success ? (qp.data.limit ?? 10) : 10;

  const prompts = await db
    .select()
    .from(promptsTable)
    .where(eq(promptsTable.isPublic, true))
    .orderBy(desc(promptsTable.saveCount), desc(promptsTable.viewCount))
    .limit(limit);

  const results = await Promise.all(prompts.map(buildPromptResponse));
  res.json(GetTrendingPromptsResponse.parse(results));
});

router.get("/prompts", async (req, res): Promise<void> => {
  const rawQuery = { ...req.query };
  for (const key of Object.keys(rawQuery)) {
    if (rawQuery[key] === "null" || rawQuery[key] === "") delete rawQuery[key];
  }
  const qp = ListPromptsQueryParams.safeParse(rawQuery);
  const params = qp.success ? qp.data : {};

  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const conditions = [eq(promptsTable.isPublic, true)];
  if (params.categoryId != null) conditions.push(eq(promptsTable.categoryId, params.categoryId));
  if ((params as any).subcategoryId != null) conditions.push(eq(promptsTable.subcategoryId, (params as any).subcategoryId));
  if (params.search) conditions.push(ilike(promptsTable.title, `%${params.search}%`));
  if (params.username) conditions.push(eq(promptsTable.authorUsername, params.username));

  let orderBy = desc(promptsTable.createdAt);
  if (params.sort === "trending" || params.sort === "most_saved") orderBy = desc(promptsTable.saveCount);
  if (params.sort === "newest") orderBy = desc(promptsTable.createdAt);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(and(...conditions));

  const prompts = await db
    .select()
    .from(promptsTable)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const results = await Promise.all(prompts.map(buildPromptResponse));
  res.json(ListPromptsResponse.parse({ prompts: results, total: countResult?.total ?? 0 }));
});

router.post("/prompts", async (req, res): Promise<void> => {
  const parsed = CreatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [prompt] = await db
    .insert(promptsTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId,
      subcategoryId: (parsed.data as any).subcategoryId ?? null,
      tags: parsed.data.tags ?? [],
      authorUsername: parsed.data.authorUsername,
      isPublic: parsed.data.isPublic ?? true,
    })
    .returning();

  const result = await buildPromptResponse(prompt);
  res.status(201).json(CreatePromptResponse.parse(result));
});

router.get("/prompts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [prompt] = await db
    .select()
    .from(promptsTable)
    .where(and(eq(promptsTable.id, params.data.id), eq(promptsTable.isPublic, true)));

  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  await db.update(promptsTable).set({ viewCount: prompt.viewCount + 1 }).where(eq(promptsTable.id, prompt.id));

  // Server-side content gating: only serve full content to users with a recorded purchase
  const { userId: clerkUserId } = getAuth(req);
  const hasAccess = await checkPromptAccess(clerkUserId ?? null, prompt.id);
  const displayPrompt = { ...prompt, viewCount: prompt.viewCount + 1 };
  if (!hasAccess) displayPrompt.content = truncateContent(prompt.content);

  const result = await buildPromptResponse(displayPrompt);
  res.json({ ...GetPromptResponse.parse(result), isGated: !hasAccess });
});

router.patch("/prompts/:id", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Ownership check: caller must own the author account (or be the firm owner)
  const [existingPrompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, params.data.id));
  if (!existingPrompt) { res.status(404).json({ error: "Prompt not found" }); return; }
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existingPrompt.authorUsername));
  const isFirmAdmin = author?.ownerClerkUserId && (author.adminClerkUserIds ?? []).includes(clerkUserId);
  if (!author || (author.clerkUserId !== clerkUserId && author.ownerClerkUserId !== clerkUserId && !isFirmAdmin)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdatePromptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Partial<typeof promptsTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content !== undefined) updates.content = parsed.data.content;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
  if (parsed.data.isPublic !== undefined) updates.isPublic = parsed.data.isPublic;

  const [prompt] = await db.update(promptsTable).set(updates).where(eq(promptsTable.id, params.data.id)).returning();
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  const result = await buildPromptResponse(prompt);
  res.json(UpdatePromptResponse.parse(result));
});

router.delete("/prompts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(promptsTable).where(eq(promptsTable.id, params.data.id));
  res.status(204).send();
});

router.post("/prompts/:id/save", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleSavePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = ToggleSavePromptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db
    .select()
    .from(savesTable)
    .where(and(eq(savesTable.username, parsed.data.username), eq(savesTable.promptId, params.data.id)));

  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, params.data.id));
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  let saved: boolean;
  let newSaveCount: number;

  if (existing) {
    await db.delete(savesTable).where(eq(savesTable.id, existing.id));
    newSaveCount = Math.max(0, prompt.saveCount - 1);
    saved = false;
  } else {
    await db.insert(savesTable).values({ username: parsed.data.username, promptId: params.data.id });
    newSaveCount = prompt.saveCount + 1;
    saved = true;
  }

  await db.update(promptsTable).set({ saveCount: newSaveCount }).where(eq(promptsTable.id, params.data.id));
  res.json(ToggleSavePromptResponse.parse({ saved, saveCount: newSaveCount }));
});

export default router;
