import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, promptsTable, categoriesTable, subcategoriesTable, usersTable, savesTable } from "@workspace/db";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
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
import { applyContentGate, gatedPromptListResponse, gatedTrendingResponse } from "../lib/contentGate";
import { checkPromptAccess, getAccessiblePromptIds, getCallerClerkUserId, requirePublisher } from "../lib/promptAccess";

const router: IRouter = Router();

async function buildPromptResponse(prompt: typeof promptsTable.$inferSelect, hasAccess: boolean) {
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, prompt.categoryId));
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));

  let subcategoryName: string | null = null;
  if (prompt.subcategoryId) {
    const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, prompt.subcategoryId));
    subcategoryName = sub?.name ?? null;
  }

  return applyContentGate({
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
    avgRating: parseFloat(prompt.avgRating as any) || 0,
    ratingCount: prompt.ratingCount,
    isPublic: prompt.isPublic,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
  }, hasAccess);
}

router.get("/prompts/trending", async (req, res): Promise<void> => {
  const qp = GetTrendingPromptsQueryParams.safeParse(req.query);
  const limit = qp.success ? (qp.data.limit ?? 10) : 10;

  const prompts = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)))
    .orderBy(desc(promptsTable.saveCount), desc(promptsTable.viewCount))
    .limit(limit);

  const accessible = await getAccessiblePromptIds(getCallerClerkUserId(req), prompts.map((p) => p.id));
  const built = await Promise.all(prompts.map((p) => buildPromptResponse(p, true)));
  res.json(GetTrendingPromptsResponse.parse(gatedTrendingResponse(built, accessible)));
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

  const conditions: any[] = [eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)];
  if (params.categoryId != null) conditions.push(eq(promptsTable.categoryId, params.categoryId));
  if ((params as any).subcategoryId != null) conditions.push(eq(promptsTable.subcategoryId, (params as any).subcategoryId));
  if (params.search) {
    // Full-text search using GIN-indexed tsvector column
    conditions.push(sql`search_vector @@ plainto_tsquery('english', ${params.search})`);
  }
  if (params.username) conditions.push(eq(promptsTable.authorUsername, params.username));

  let orderBy = desc(promptsTable.createdAt);
  if (params.sort === "trending" || params.sort === "most_saved") orderBy = desc(promptsTable.saveCount);
  if (params.sort === "newest") orderBy = desc(promptsTable.createdAt);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(and(...conditions));

  const prompts = await db.select().from(promptsTable)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const accessible = await getAccessiblePromptIds(getCallerClerkUserId(req), prompts.map((p) => p.id));
  const built = await Promise.all(prompts.map((p) => buildPromptResponse(p, true)));
  res.json(ListPromptsResponse.parse(gatedPromptListResponse(built, accessible, countResult?.total ?? 0)));
});

router.post("/prompts", async (req, res): Promise<void> => {
  const parsed = CreatePromptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const publisher = await requirePublisher(getCallerClerkUserId(req), parsed.data.authorUsername);
  if (!publisher.ok) {
    res.status(publisher.status).json({ error: publisher.error });
    return;
  }

  const [prompt] = await db.insert(promptsTable).values({
    title: parsed.data.title,
    content: parsed.data.content,
    description: parsed.data.description ?? null,
    categoryId: parsed.data.categoryId,
    subcategoryId: (parsed.data as any).subcategoryId ?? null,
    tags: parsed.data.tags ?? [],
    authorUsername: publisher.authorUsername,
    isPublic: parsed.data.isPublic ?? true,
  }).returning();

  const result = await buildPromptResponse(prompt, true);
  res.status(201).json(CreatePromptResponse.parse(result));
});

router.get("/prompts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [prompt] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, params.data.id), eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)));

  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  await db.update(promptsTable).set({ viewCount: prompt.viewCount + 1 }).where(eq(promptsTable.id, prompt.id));

  const hasAccess = await checkPromptAccess(getCallerClerkUserId(req), prompt.id);
  const result = await buildPromptResponse({ ...prompt, viewCount: prompt.viewCount + 1 }, hasAccess);
  res.json(GetPromptResponse.parse(result));
});

router.patch("/prompts/:id", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existingPrompt] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, params.data.id), isNull(promptsTable.deletedAt)));
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

  const [prompt] = await db.update(promptsTable).set(updates)
    .where(and(eq(promptsTable.id, params.data.id), isNull(promptsTable.deletedAt)))
    .returning();
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  const result = await buildPromptResponse(prompt, true);
  res.json(UpdatePromptResponse.parse(result));
});

router.delete("/prompts/:id", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existingPrompt] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, params.data.id), isNull(promptsTable.deletedAt)));
  if (!existingPrompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existingPrompt.authorUsername));
  const isFirmAdmin = author?.ownerClerkUserId && (author.adminClerkUserIds ?? []).includes(clerkUserId);
  if (!author || (author.clerkUserId !== clerkUserId && author.ownerClerkUserId !== clerkUserId && !isFirmAdmin)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  // Soft delete — preserve the row, ratings, purchases, library memberships
  await db.update(promptsTable)
    .set({ deletedAt: new Date() })
    .where(eq(promptsTable.id, params.data.id));

  res.json({ ok: true });
});

router.post("/prompts/:id/save", async (req, res): Promise<void> => {
  const publisher = await requirePublisher(getCallerClerkUserId(req));
  if (!publisher.ok) {
    res.status(publisher.status).json({ error: publisher.error });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleSavePromptParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = ToggleSavePromptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const username = publisher.authorUsername;

  const [existing] = await db.select().from(savesTable)
    .where(and(eq(savesTable.username, username), eq(savesTable.promptId, params.data.id)));

  const [prompt] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, params.data.id), isNull(promptsTable.deletedAt)));
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  let saved: boolean;
  let newSaveCount: number;

  if (existing) {
    await db.delete(savesTable).where(eq(savesTable.id, existing.id));
    newSaveCount = Math.max(0, prompt.saveCount - 1);
    saved = false;
  } else {
    await db.insert(savesTable).values({ username, promptId: params.data.id });
    newSaveCount = prompt.saveCount + 1;
    saved = true;
  }

  await db.update(promptsTable).set({ saveCount: newSaveCount }).where(eq(promptsTable.id, params.data.id));
  res.json(ToggleSavePromptResponse.parse({ saved, saveCount: newSaveCount }));
});

export default router;
