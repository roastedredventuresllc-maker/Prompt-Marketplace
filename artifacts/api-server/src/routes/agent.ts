/**
 * Agent API — API key management, credits, and agent-native purchasing.
 *
 * Key endpoints:
 *   GET  /api/agent/keys            list caller's keys (Clerk auth)
 *   POST /api/agent/keys            create a new key (Clerk auth) → returns raw key ONCE
 *   PATCH /api/agent/keys/:id       rename a key (Clerk auth)
 *   DELETE /api/agent/keys/:id      revoke a key (Clerk auth)
 *   POST /api/agent/keys/:id/topup  add credits (Clerk auth, amount in dollars)
 *
 *   GET  /api/agent/balance         check balance (Bearer auth)
 *   POST /api/agent/purchase        buy a prompt (Bearer auth, deducts credits)
 *   GET  /api/agent/purchased       list purchased prompts (Bearer auth)
 *   GET  /api/prompts/:id/content   full prompt text if purchased (Bearer OR Clerk auth)
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { createHash, randomBytes } from "node:crypto";
import { db, apiKeysTable, usersTable, promptsTable, purchasesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { calculateTransactionAmounts } from "../lib/commission";

const router: Router = Router();

// ── helpers ──────────────────────────────────────────────────────────────

function generateKey(): { raw: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("hex"); // 64 chars of hex
  const raw = `sk_${secret}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12); // "sk_" + first 9 chars — enough to identify it
  return { raw, hash, prefix };
}

function requireClerk(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): string | null {
  const { userId } = getAuth(req as any);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

function requireBearer(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  const apiKey = (req as any).apiKey as typeof apiKeysTable.$inferSelect | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Valid Bearer API key required. Get one at /settings." });
    return null;
  }
  return apiKey;
}

// ── Key management (Clerk-authenticated) ─────────────────────────────────

/** List all keys for the signed-in user (hashes never returned, prefixes only) */
router.get("/agent/keys", async (req, res): Promise<void> => {
  const userId = requireClerk(req as any, res as any);
  if (!userId) return;

  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      creditsCents: apiKeysTable.creditsCents,
      isActive: apiKeysTable.isActive,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.ownerClerkUserId, userId))
    .orderBy(desc(apiKeysTable.createdAt));

  res.json(keys);
});

/** Create a new API key — raw key returned ONCE, store it securely */
router.post("/agent/keys", async (req, res): Promise<void> => {
  const userId = requireClerk(req as any, res as any);
  if (!userId) return;

  const { name = "My key" } = req.body as { name?: string };

  // Limit to 10 active keys per user
  const existing = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.ownerClerkUserId, userId), eq(apiKeysTable.isActive, true)));

  if (existing.length >= 10) {
    res.status(400).json({ error: "Maximum of 10 active keys reached" });
    return;
  }

  const { raw, hash, prefix } = generateKey();

  const [created] = await db
    .insert(apiKeysTable)
    .values({ ownerClerkUserId: userId, keyHash: hash, keyPrefix: prefix, name })
    .returning();

  // Raw key is returned exactly once — never stored, never retrievable again
  res.status(201).json({
    id: created.id,
    name: created.name,
    keyPrefix: created.keyPrefix,
    rawKey: raw, // show once
    creditsCents: created.creditsCents,
    createdAt: created.createdAt,
  });
});

/** Rename a key */
router.patch("/agent/keys/:id", async (req, res): Promise<void> => {
  const userId = requireClerk(req as any, res as any);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }

  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.ownerClerkUserId, userId)));

  if (!key) { res.status(404).json({ error: "Key not found" }); return; }

  const [updated] = await db
    .update(apiKeysTable)
    .set({ name: name.trim() })
    .where(eq(apiKeysTable.id, id))
    .returning({ id: apiKeysTable.id, name: apiKeysTable.name });

  res.json(updated);
});

/** Revoke a key */
router.delete("/agent/keys/:id", async (req, res): Promise<void> => {
  const userId = requireClerk(req as any, res as any);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);

  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.ownerClerkUserId, userId)));

  if (!key) { res.status(404).json({ error: "Key not found" }); return; }

  await db
    .update(apiKeysTable)
    .set({ isActive: false })
    .where(eq(apiKeysTable.id, id));

  res.json({ success: true });
});

/** Credit top-ups must go through the verified Whop checkout route. */
router.post("/agent/keys/:id/topup", async (req, res): Promise<void> => {
  res.status(410).json({
    error: "Direct top-ups are disabled. Use /api/checkout/topup/:id.",
  });
});

// ── Agent operations (Bearer-authenticated) ───────────────────────────────

/** Check credits balance */
router.get("/agent/balance", async (req, res): Promise<void> => {
  const apiKey = requireBearer(req as any, res as any);
  if (!apiKey) return;
  res.json({ creditsCents: apiKey.creditsCents, creditsDollars: (apiKey.creditsCents / 100).toFixed(2) });
});

/** List prompts this key's owner has purchased */
router.get("/agent/purchased", async (req, res): Promise<void> => {
  const apiKey = requireBearer(req as any, res as any);
  if (!apiKey) return;

  const purchases = await db
    .select({
      id: purchasesTable.id,
      itemType: purchasesTable.itemType,
      itemId: purchasesTable.itemId,
      priceCents: purchasesTable.priceCents,
      purchasedAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId),
        eq(purchasesTable.itemType, "prompt"),
      ),
    )
    .orderBy(desc(purchasesTable.createdAt));

  res.json(purchases);
});

/**
 * Purchase a prompt using credits.
 * Body: { promptId: number }
 * Deducts credits, records in purchases table, returns full content.
 */
router.post("/agent/purchase", async (req, res): Promise<void> => {
  const apiKey = requireBearer(req as any, res as any);
  if (!apiKey) return;

  const { promptId } = req.body as { promptId?: number };
  if (!promptId) { res.status(400).json({ error: "promptId required" }); return; }

  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  // Check if already purchased
  const [existing] = await db
    .select()
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId),
        eq(purchasesTable.itemType, "prompt"),
        eq(purchasesTable.itemId, promptId),
      ),
    );

  if (existing) {
    // Already purchased — just return content
    res.json({ alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } });
    return;
  }

  // Check if the author is the key owner (authors always have access to their own prompts)
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const isAuthor = author && (author.clerkUserId === apiKey.ownerClerkUserId || author.ownerClerkUserId === apiKey.ownerClerkUserId);

  if (isAuthor) {
    res.json({ alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } });
    return;
  }

  // Determine price
  const priceCents = author?.promptPriceCents ?? 500;
  const amounts = calculateTransactionAmounts(priceCents);

  // Free prompt — no credits needed
  if (priceCents === 0) {
    await db.insert(purchasesTable).values({
      clerkUserId: apiKey.ownerClerkUserId,
      itemType: "prompt",
      itemId: promptId,
      priceCents: 0,
      transactionType: "prompt_purchase",
      commissionCents: 0,
      netCents: 0,
    });
    res.json({ success: true, charged: 0, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } });
    return;
  }

  // Check credits
  if (apiKey.creditsCents < priceCents) {
    res.status(402).json({
      error: "Insufficient credits",
      required: priceCents,
      available: apiKey.creditsCents,
      shortfall: priceCents - apiKey.creditsCents,
    });
    return;
  }

  // Deduct credits atomically and record purchase
  await db.update(apiKeysTable).set({ creditsCents: apiKey.creditsCents - priceCents }).where(eq(apiKeysTable.id, apiKey.id));
  await db.insert(purchasesTable).values({
    clerkUserId: apiKey.ownerClerkUserId,
    itemType: "prompt",
    itemId: promptId,
    priceCents,
    transactionType: "prompt_purchase",
    commissionCents: amounts.commissionCents,
    netCents: amounts.netCents,
  });

  res.json({
    success: true,
    charged: priceCents,
    commissionCents: amounts.commissionCents,
    creatorNetCents: amounts.netCents,
    remainingCreditsCents: apiKey.creditsCents - priceCents,
    prompt: { id: prompt.id, title: prompt.title, content: prompt.content },
  });
});

/**
 * GET /api/prompts/:id/content
 * Returns full prompt content if the caller has purchased it (or is the author).
 * Accepts both Bearer API key auth and Clerk session auth.
 */
router.get("/prompts/:id/content", async (req, res): Promise<void> => {
  const promptId = parseInt(req.params.id, 10);
  if (isNaN(promptId)) { res.status(400).json({ error: "Invalid prompt id" }); return; }

  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  // Resolve caller identity — from API key or Clerk session
  const apiKey = (req as any).apiKey as typeof apiKeysTable.$inferSelect | undefined;
  const callerClerkUserId = apiKey?.ownerClerkUserId ?? getAuth(req as any).userId;

  if (!callerClerkUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Author always has access
  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const isAuthor = author && (author.clerkUserId === callerClerkUserId || author.ownerClerkUserId === callerClerkUserId);
  if (isAuthor) {
    res.json({ id: prompt.id, title: prompt.title, content: prompt.content });
    return;
  }

  // Check purchase record
  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, callerClerkUserId),
        eq(purchasesTable.itemType, "prompt"),
        eq(purchasesTable.itemId, promptId),
      ),
    );

  if (purchase) {
    res.json({ id: prompt.id, title: prompt.title, content: prompt.content });
    return;
  }

  res.status(403).json({ error: "Purchase required", priceCents: author?.promptPriceCents ?? 500 });
});

export default router;
