/**
 * MCP (Model Context Protocol) server — HTTP stateless transport.
 *
 * POST /api/mcp
 *   Auth: Authorization: Bearer sk_...
 *   Body: JSON-RPC 2.0 request
 *   Response: JSON-RPC 2.0 response
 *
 * Discovery:
 *   GET /.well-known/mcp.json  →  { endpoint: "/api/mcp", ... }
 *
 * Supported methods:
 *   initialize            Handshake — returns server capabilities
 *   tools/list            List available tools
 *   tools/call            Call a tool by name
 *
 * Tools:
 *   search_prompts        Browse the prompt catalog
 *   get_prompt            Prompt metadata + truncated preview
 *   get_balance           Check remaining credits on this key
 *   purchase_prompt       Buy a prompt (deducts credits, returns full text)
 *   list_purchased        List prompts already purchased by this key
 */

import { Router } from "express";
import { db, promptsTable, categoriesTable, usersTable, purchasesTable, apiKeysTable, libraryPromptsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

const router: Router = Router();

// ── Tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_prompts",
    description: "Browse and search the Promptly prompt catalog. Returns metadata and a short content preview for each matching prompt. Use get_prompt for full details, or purchase_prompt to unlock the full text.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional keyword search across title, description, and tags" },
        category: { type: "string", description: "Filter by category slug, e.g. 'finance', 'writing', 'marketing'" },
        limit: { type: "number", description: "Max results (1–50, default 20)" },
      },
    },
  },
  {
    name: "get_prompt",
    description: "Get metadata and a truncated preview (first 300 chars) for a specific prompt. Purchase the prompt to get full content.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_balance",
    description: "Check the credit balance remaining on this API key.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "purchase_prompt",
    description: "Purchase access to a prompt using API credits. Credits are deducted from this key's balance and the full prompt text is returned immediately. If already purchased, returns the content without charging again.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to purchase" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_purchased",
    description: "List all prompts already purchased by this API key. Returns IDs and titles; call get_prompt/:id/content to retrieve the text of a specific prompt.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1–100, default 50)" },
      },
    },
  },
  {
    name: "create_prompt",
    description: "Publish a new prompt to the Promptly marketplace under your account. Returns the created prompt ID and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Prompt title (max 200 chars)" },
        content: { type: "string", description: "The full prompt text" },
        description: { type: "string", description: "Short description shown on listing cards (optional)" },
        categoryId: { type: "number", description: "Category ID — use search_prompts to see categories, or omit to use category 1" },
        tags: { type: "array", items: { type: "string" }, description: "Optional list of tags" },
        isPublic: { type: "boolean", description: "Whether the prompt is publicly listed (default true)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_prompt",
    description: "Update a prompt you own. Only fields you include are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to update" },
        title: { type: "string", description: "New title" },
        content: { type: "string", description: "New prompt text" },
        description: { type: "string", description: "New description" },
        categoryId: { type: "number", description: "New category ID" },
        tags: { type: "array", items: { type: "string" }, description: "New tags (replaces existing)" },
        isPublic: { type: "boolean", description: "Set visibility" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_prompt",
    description: "Permanently delete a prompt you own. This cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to delete" },
      },
      required: ["id"],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────

async function searchPrompts(args: Record<string, any>) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "20"), 1), 50);
  // Fetch more than needed so JS-side filtering still returns enough results
  const fetchLimit = args.query ? Math.min(limit * 5, 200) : limit;

  const rows = await db
    .select({
      id: promptsTable.id,
      title: promptsTable.title,
      description: promptsTable.description,
      contentPreview: sql<string>`left(${promptsTable.content}, 300)`,
      tags: promptsTable.tags,
      authorUsername: promptsTable.authorUsername,
      saveCount: promptsTable.saveCount,
      categoryId: promptsTable.categoryId,
    })
    .from(promptsTable)
    .where(eq(promptsTable.isPublic, true))
    .orderBy(desc(promptsTable.saveCount))
    .limit(fetchLimit);

  // Filter by text query in JS (avoids full-text index requirement)
  let results = rows;
  if (args.query) {
    const q = (args.query as string).toLowerCase();
    results = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Filter by category slug
  if (args.category) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, args.category));
    if (cat) results = results.filter((r) => r.categoryId === cat.id);
  }

  results = results.slice(0, limit);

  if (results.length === 0) return [];

  // Resolve author pricing — guard against empty IN list
  const authorNames = [...new Set(results.map((r) => r.authorUsername))];
  const authors = await db
    .select({ username: usersTable.username, promptPriceCents: usersTable.promptPriceCents })
    .from(usersTable)
    .where(sql`${usersTable.username} = ANY(ARRAY[${sql.join(authorNames.map((n) => sql`${n}`), sql`, `)}])`);
  const pricingByAuthor = Object.fromEntries(authors.map((a) => [a.username, a.promptPriceCents]));

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    contentPreview: r.contentPreview + (r.contentPreview.length >= 300 ? "…" : ""),
    tags: r.tags,
    author: r.authorUsername,
    saves: r.saveCount,
    priceCents: pricingByAuthor[r.authorUsername] ?? 500,
    purchaseUrl: `POST /api/agent/purchase with { promptId: ${r.id} }`,
  }));
}

async function getPrompt(args: Record<string, any>) {
  const id = parseInt(args.id, 10);
  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, id));
  if (!prompt) throw new Error(`Prompt ${id} not found`);

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const preview = prompt.content.slice(0, 300) + (prompt.content.length > 300 ? "…" : "");

  return {
    id: prompt.id,
    title: prompt.title,
    description: prompt.description ?? "",
    contentPreview: preview,
    tags: prompt.tags,
    author: prompt.authorUsername,
    priceCents: author?.promptPriceCents ?? 500,
    saves: prompt.saveCount,
    createdAt: prompt.createdAt,
    note: "Call purchase_prompt with this id to unlock the full content.",
  };
}

async function getBalance(apiKey: typeof apiKeysTable.$inferSelect) {
  return {
    creditsCents: apiKey.creditsCents,
    creditsDollars: (apiKey.creditsCents / 100).toFixed(2),
    note: "Top up via the Promptly settings page under API Keys.",
  };
}

async function purchasePrompt(args: Record<string, any>, apiKey: typeof apiKeysTable.$inferSelect) {
  const promptId = parseInt(args.id, 10);
  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (!prompt) throw new Error(`Prompt ${promptId} not found`);

  // Already purchased?
  const [existing] = await db.select().from(purchasesTable).where(
    and(
      eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId),
      eq(purchasesTable.itemType, "prompt"),
      eq(purchasesTable.itemId, promptId),
    ),
  );
  if (existing) {
    return { alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } };
  }

  // Author access?
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const isAuthor = author && (author.clerkUserId === apiKey.ownerClerkUserId || author.ownerClerkUserId === apiKey.ownerClerkUserId);
  if (isAuthor) {
    return { alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } };
  }

  const priceCents = author?.promptPriceCents ?? 500;
  if (priceCents > 0 && apiKey.creditsCents < priceCents) {
    throw new Error(
      `Insufficient credits. Need $${(priceCents / 100).toFixed(2)}, have $${(apiKey.creditsCents / 100).toFixed(2)}. Top up at the Promptly settings page.`,
    );
  }

  if (priceCents > 0) {
    await db.update(apiKeysTable).set({ creditsCents: apiKey.creditsCents - priceCents }).where(eq(apiKeysTable.id, apiKey.id));
  }
  await db.insert(purchasesTable).values({
    clerkUserId: apiKey.ownerClerkUserId,
    itemType: "prompt",
    itemId: promptId,
    priceCents,
  });

  return {
    success: true,
    charged: priceCents,
    remainingCreditsCents: apiKey.creditsCents - priceCents,
    prompt: { id: prompt.id, title: prompt.title, content: prompt.content },
  };
}

async function listPurchased(args: Record<string, any>, apiKey: typeof apiKeysTable.$inferSelect) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 100);

  const rows = await db
    .select({ itemId: purchasesTable.itemId, priceCents: purchasesTable.priceCents, purchasedAt: purchasesTable.createdAt })
    .from(purchasesTable)
    .where(and(eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId), eq(purchasesTable.itemType, "prompt")))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.itemId);
  if (ids.length === 0) return [];

  const prompts = await db.select({ id: promptsTable.id, title: promptsTable.title })
    .from(promptsTable)
    .where(sql`${promptsTable.id} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])`);

  const byId = Object.fromEntries(prompts.map((p) => [p.id, p.title]));
  return rows.map((r) => ({ id: r.itemId, title: byId[r.itemId] ?? "Unknown", priceCents: r.priceCents, purchasedAt: r.purchasedAt }));
}

async function createPrompt(args: Record<string, any>, apiKey: typeof apiKeysTable.$inferSelect) {
  // Resolve author account from the API key owner
  const [author] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, apiKey.ownerClerkUserId));
  if (!author) throw new Error("No Promptly profile found for this API key. Complete onboarding at https://promptly.app/onboarding first.");

  const title = String(args.title ?? "").trim();
  const content = String(args.content ?? "").trim();
  if (!title) throw new Error("title is required");
  if (!content) throw new Error("content is required");

  const categoryId = args.categoryId ? parseInt(args.categoryId, 10) : 1;
  const tags: string[] = Array.isArray(args.tags) ? args.tags.map(String) : [];
  const isPublic: boolean = args.isPublic !== undefined ? Boolean(args.isPublic) : true;

  const [prompt] = await db
    .insert(promptsTable)
    .values({
      title,
      content,
      description: args.description ? String(args.description) : null,
      categoryId,
      tags,
      authorUsername: author.username,
      isPublic,
    })
    .returning();

  return {
    success: true,
    prompt: {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      categoryId: prompt.categoryId,
      tags: prompt.tags,
      isPublic: prompt.isPublic,
      author: prompt.authorUsername,
      createdAt: prompt.createdAt,
    },
  };
}

async function updatePrompt(args: Record<string, any>, apiKey: typeof apiKeysTable.$inferSelect) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [existing] = await db.select().from(promptsTable).where(eq(promptsTable.id, id));
  if (!existing) throw new Error(`Prompt ${id} not found`);

  // Ownership check
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existing.authorUsername));
  const isOwner = author && (author.clerkUserId === apiKey.ownerClerkUserId || author.ownerClerkUserId === apiKey.ownerClerkUserId);
  if (!isOwner) throw new Error("Forbidden — you do not own this prompt");

  const updates: Partial<typeof promptsTable.$inferInsert> = { updatedAt: new Date() };
  if (args.title !== undefined) updates.title = String(args.title).trim();
  if (args.content !== undefined) updates.content = String(args.content);
  if (args.description !== undefined) updates.description = String(args.description);
  if (args.categoryId !== undefined) updates.categoryId = parseInt(args.categoryId, 10);
  if (args.tags !== undefined) updates.tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
  if (args.isPublic !== undefined) updates.isPublic = Boolean(args.isPublic);

  const [prompt] = await db.update(promptsTable).set(updates).where(eq(promptsTable.id, id)).returning();

  return {
    success: true,
    prompt: {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      categoryId: prompt.categoryId,
      tags: prompt.tags,
      isPublic: prompt.isPublic,
      updatedAt: prompt.updatedAt,
    },
  };
}

async function deletePrompt(args: Record<string, any>, apiKey: typeof apiKeysTable.$inferSelect) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [existing] = await db.select().from(promptsTable).where(eq(promptsTable.id, id));
  if (!existing) throw new Error(`Prompt ${id} not found`);

  // Ownership check
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existing.authorUsername));
  const isOwner = author && (author.clerkUserId === apiKey.ownerClerkUserId || author.ownerClerkUserId === apiKey.ownerClerkUserId);
  if (!isOwner) throw new Error("Forbidden — you do not own this prompt");

  await db.delete(libraryPromptsTable).where(eq(libraryPromptsTable.promptId, id));
  await db.delete(promptsTable).where(eq(promptsTable.id, id));

  return { success: true, deleted: { id, title: existing.title } };
}

// ── JSON-RPC dispatcher ───────────────────────────────────────────────────

function jsonrpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function jsonrpcOk(id: any, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

// ── Route ─────────────────────────────────────────────────────────────────

router.post("/mcp", async (req, res): Promise<void> => {
  const apiKey = (req as any).apiKey as typeof apiKeysTable.$inferSelect | undefined;

  const body = req.body as { jsonrpc?: string; method?: string; params?: any; id?: any };
  const { id = null, method, params = {} } = body;

  if (!method) {
    res.json(jsonrpcError(id, -32600, "Invalid request — missing method"));
    return;
  }

  try {
    if (method === "initialize") {
      res.json(jsonrpcOk(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "Promptly", version: "1.0.0" },
        instructions: "Promptly is an AI prompt marketplace. Use search_prompts to find prompts, purchase_prompt to buy them with credits, and list_purchased to see what you own. Authenticate with a Bearer API key from https://promptly.app/settings.",
      }));
      return;
    }

    if (method === "tools/list") {
      res.json(jsonrpcOk(id, { tools: TOOLS }));
      return;
    }

    if (method === "tools/call") {
      const { name, arguments: args = {} } = params as { name?: string; arguments?: Record<string, any> };
      if (!name) { res.json(jsonrpcError(id, -32602, "Missing tool name")); return; }

      // Tools that need auth
      const authRequired = ["get_balance", "purchase_prompt", "list_purchased", "create_prompt", "update_prompt", "delete_prompt"];
      if (authRequired.includes(name) && !apiKey) {
        res.json(jsonrpcError(id, -32001, "This tool requires authentication. Include an Authorization: Bearer sk_... header."));
        return;
      }

      let result: unknown;
      if (name === "search_prompts") result = await searchPrompts(args);
      else if (name === "get_prompt") result = await getPrompt(args);
      else if (name === "get_balance") result = await getBalance(apiKey!);
      else if (name === "purchase_prompt") result = await purchasePrompt(args, apiKey!);
      else if (name === "list_purchased") result = await listPurchased(args, apiKey!);
      else if (name === "create_prompt") result = await createPrompt(args, apiKey!);
      else if (name === "update_prompt") result = await updatePrompt(args, apiKey!);
      else if (name === "delete_prompt") result = await deletePrompt(args, apiKey!);
      else { res.json(jsonrpcError(id, -32601, `Unknown tool: ${name}`)); return; }

      res.json(jsonrpcOk(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }));
      return;
    }

    res.json(jsonrpcError(id, -32601, `Unknown method: ${method}`));
  } catch (err: any) {
    res.json(jsonrpcError(id, -32000, err?.message ?? "Internal error"));
  }
});

export default router;
