import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, librariesTable, libraryPromptsTable, promptsTable, categoriesTable, subcategoriesTable, usersTable } from "@workspace/db";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import {
  CreateLibraryBody,
  CreateLibraryResponse,
  GetLibraryParams,
  GetLibraryResponse,
  UpdateLibraryBody,
  UpdateLibraryParams,
  UpdateLibraryResponse,
  DeleteLibraryParams,
  ListLibrariesQueryParams,
  ListLibrariesResponse,
  AddPromptToLibraryBody,
  AddPromptToLibraryParams,
  AddPromptToLibraryResponse,
  RemovePromptFromLibraryParams,
  RemovePromptFromLibraryResponse,
  GetUserLibrariesParams,
  GetUserLibrariesResponse,
} from "@workspace/api-zod";
import { applyContentGate, gatePromptCollection, libraryMembershipUnlocksPrompt } from "../lib/contentGate";
import { getAccessiblePromptIds, getCallerClerkUserId, loadOwnedLibrary } from "../lib/promptAccess";

const router: IRouter = Router();

async function buildLibraryResponse(library: typeof librariesTable.$inferSelect) {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(libraryPromptsTable)
    .where(eq(libraryPromptsTable.libraryId, library.id));

  const [author] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, library.authorUsername));

  // Fetch up to 3 preview prompt titles for the card
  const previewRows = await db
    .select({ title: promptsTable.title })
    .from(libraryPromptsTable)
    .innerJoin(promptsTable, eq(libraryPromptsTable.promptId, promptsTable.id))
    .where(eq(libraryPromptsTable.libraryId, library.id))
    .orderBy(libraryPromptsTable.addedAt)
    .limit(3);

  return {
    id: library.id,
    name: library.name,
    description: library.description ?? null,
    authorUsername: library.authorUsername,
    authorDisplayName: author?.displayName ?? library.authorUsername,
    promptCount: countResult?.count ?? 0,
    previewTitles: previewRows.map(r => r.title),
    isPublic: library.isPublic,
    kind: (library as any).kind ?? "collection",
    priceCents: library.priceCents ?? null,
    createdAt: library.createdAt.toISOString(),
    updatedAt: library.updatedAt.toISOString(),
  };
}

async function buildPromptItem(prompt: typeof promptsTable.$inferSelect, hasAccess: boolean) {
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, prompt.categoryId));
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const [subcategory] = prompt.subcategoryId
    ? await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, prompt.subcategoryId))
    : [undefined];
  return applyContentGate({
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    description: prompt.description ?? null,
    categoryId: prompt.categoryId,
    categoryName: category?.name ?? "Uncategorized",
    subcategoryId: prompt.subcategoryId ?? null,
    subcategoryName: subcategory?.name ?? null,
    tags: prompt.tags ?? [],
    authorUsername: prompt.authorUsername,
    authorDisplayName: author?.displayName ?? prompt.authorUsername,
    authorAvatarUrl: author?.avatarUrl ?? null,
    authorOrgType: (author as any)?.orgType ?? "individual",
    authorOrgName: (author as any)?.orgName ?? null,
    saveCount: prompt.saveCount,
    viewCount: prompt.viewCount,
    isPublic: prompt.isPublic,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
  }, hasAccess);
}

router.get("/users/:username/libraries", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const params = GetUserLibrariesParams.safeParse({ username: raw });
  if (!params.success) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const libraries = await db
    .select()
    .from(librariesTable)
    .where(eq(librariesTable.authorUsername, params.data.username))
    .orderBy(desc(librariesTable.createdAt));

  const results = await Promise.all(libraries.map(buildLibraryResponse));
  res.json(GetUserLibrariesResponse.parse(results));
});

router.get("/libraries", async (req, res): Promise<void> => {
  const qp = ListLibrariesQueryParams.safeParse(req.query);
  const params = qp.success ? qp.data : {};
  const limit = params.limit ?? 20;

  const conditions = [eq(librariesTable.isPublic, true)];
  if (params.username) {
    conditions.push(eq(librariesTable.authorUsername, params.username));
  }

  const libraries = await db
    .select()
    .from(librariesTable)
    .where(and(...conditions))
    .orderBy(desc(librariesTable.createdAt))
    .limit(limit);

  const results = await Promise.all(libraries.map(buildLibraryResponse));
  res.json(ListLibrariesResponse.parse(results));
});

router.post("/libraries", async (req, res): Promise<void> => {
  const parsed = CreateLibraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [library] = await db
    .insert(librariesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      authorUsername: parsed.data.authorUsername,
      isPublic: parsed.data.isPublic ?? true,
    } as any)
    .returning();

  const result = await buildLibraryResponse(library);
  res.status(201).json(CreateLibraryResponse.parse(result));
});

router.get("/libraries/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetLibraryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [library] = await db
    .select()
    .from(librariesTable)
    .where(and(eq(librariesTable.id, params.data.id), eq(librariesTable.isPublic, true)));
  if (!library) {
    res.status(404).json({ error: "Library not found" });
    return;
  }

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, library.authorUsername));

  const libraryPrompts = await db
    .select()
    .from(libraryPromptsTable)
    .where(eq(libraryPromptsTable.libraryId, library.id))
    .orderBy(desc(libraryPromptsTable.addedAt));

  const prompts: typeof promptsTable.$inferSelect[] = [];
  for (const lp of libraryPrompts) {
    const [p] = await db.select().from(promptsTable).where(and(eq(promptsTable.id, lp.promptId), isNull(promptsTable.deletedAt)));
    if (p) prompts.push(p);
  }

  const accessible = await getAccessiblePromptIds(getCallerClerkUserId(req), prompts.map((p) => p.id));
  const built = await Promise.all(prompts.map((p) => buildPromptItem(p, true)));
  const promptItems = gatePromptCollection(built, accessible);

  const result = {
    id: library.id,
    name: library.name,
    description: library.description ?? null,
    authorUsername: library.authorUsername,
    authorDisplayName: author?.displayName ?? library.authorUsername,
    isPublic: library.isPublic,
    kind: (library as any).kind ?? "collection",
    priceCents: library.priceCents ?? null,
    prompts: promptItems,
    createdAt: library.createdAt.toISOString(),
    updatedAt: library.updatedAt.toISOString(),
  };

  res.json(GetLibraryResponse.parse(result));
});

router.patch("/libraries/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateLibraryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateLibraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof librariesTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isPublic !== undefined) updates.isPublic = parsed.data.isPublic;
  const rawBody = req.body as Record<string, any>;
  if (rawBody.priceCents !== undefined) {
    updates.priceCents = rawBody.priceCents === null ? null : Number(rawBody.priceCents) || null;
  }

  const [library] = await db
    .update(librariesTable)
    .set(updates)
    .where(eq(librariesTable.id, params.data.id))
    .returning();

  if (!library) {
    res.status(404).json({ error: "Library not found" });
    return;
  }

  const result = await buildLibraryResponse(library);
  res.json({ ...UpdateLibraryResponse.parse(result), priceCents: library.priceCents ?? null });
});

router.delete("/libraries/:id", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteLibraryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [library] = await db.select().from(librariesTable).where(eq(librariesTable.id, params.data.id));
  if (!library) { res.status(404).json({ error: "Library not found" }); return; }

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, library.authorUsername));
  const isFirmAdmin = author?.ownerClerkUserId && (author.adminClerkUserIds ?? []).includes(clerkUserId);
  if (!author || (author.clerkUserId !== clerkUserId && author.ownerClerkUserId !== clerkUserId && !isFirmAdmin)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(libraryPromptsTable).where(eq(libraryPromptsTable.libraryId, params.data.id));
  await db.delete(librariesTable).where(eq(librariesTable.id, params.data.id));
  res.status(204).send();
});

router.post("/libraries/:id/prompts", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPromptToLibraryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const owned = await loadOwnedLibrary(getCallerClerkUserId(req), params.data.id);
  if (!owned.ok) {
    res.status(owned.status).json({ error: owned.error });
    return;
  }

  const parsed = AddPromptToLibraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [promptRow] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, parsed.data.promptId), isNull(promptsTable.deletedAt)));
  if (!promptRow) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  if (!libraryMembershipUnlocksPrompt(promptRow.authorUsername, owned.library.authorUsername)) {
    res.status(403).json({ error: "Collections may only include prompts from this collection's author" });
    return;
  }

  // Check if already in library
  const [existing] = await db
    .select()
    .from(libraryPromptsTable)
    .where(
      and(
        eq(libraryPromptsTable.libraryId, params.data.id),
        eq(libraryPromptsTable.promptId, parsed.data.promptId),
      ),
    );

  if (!existing) {
    await db.insert(libraryPromptsTable).values({
      libraryId: params.data.id,
      promptId: parsed.data.promptId,
    });

    await db.update(librariesTable).set({ updatedAt: new Date() }).where(eq(librariesTable.id, params.data.id));
  }

  const result = await buildLibraryResponse(owned.library);
  res.json(AddPromptToLibraryResponse.parse(result));
});

router.delete("/libraries/:id/prompts/:promptId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawPromptId = Array.isArray(req.params.promptId) ? req.params.promptId[0] : req.params.promptId;
  const params = RemovePromptFromLibraryParams.safeParse({
    id: parseInt(rawId, 10),
    promptId: parseInt(rawPromptId, 10),
  });

  if (!params.success) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
  }

  const owned = await loadOwnedLibrary(getCallerClerkUserId(req), params.data.id);
  if (!owned.ok) {
    res.status(owned.status).json({ error: owned.error });
    return;
  }

  await db
    .delete(libraryPromptsTable)
    .where(
      and(
        eq(libraryPromptsTable.libraryId, params.data.id),
        eq(libraryPromptsTable.promptId, params.data.promptId),
      ),
    );

  await db.update(librariesTable).set({ updatedAt: new Date() }).where(eq(librariesTable.id, params.data.id));

  const result = await buildLibraryResponse(owned.library);
  res.json(RemovePromptFromLibraryResponse.parse(result));
});

export default router;
