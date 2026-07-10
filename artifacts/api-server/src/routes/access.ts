import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  usersTable,
  purchasesTable,
  promptsTable,
  librariesTable,
  libraryPromptsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router: Router = Router();

/* ── Whop REST helper (same pattern as whop-api.mjs) ──────────────────── */
async function whopApi(method: string, path: string, body?: object): Promise<any> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) throw new Error("Missing Replit env vars for Whop");

  const resp = await fetch(`https://${hostname}/api/v2/proxy/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Replit-Token": xReplitToken,
      "Connector-Name": "whop",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return resp.json();
}

/* ── Plan resolver: standard prices → pre-created; else dynamic ─────── */
async function resolvePlanId(priceCents: number): Promise<string> {
  if (priceCents === 500) return process.env.WHOP_PROMPT_PLAN_ID!;
  if (priceCents === 10000) return process.env.WHOP_COLLECTION_PLAN_ID!;
  const plan = await whopApi("POST", "/api/v1/plans", {
    product_id: "prod_O9RuGmzn0dt7G",
    company_id: process.env.WHOP_COMPANY_ID!,
    plan_type: "one_time",
    initial_price: priceCents / 100,
    currency: "usd",
    visibility: "hidden",
  });
  if (!plan?.id) throw new Error("Whop plan creation failed");
  return plan.id as string;
}

/* ── GET /api/access/prompt/:id ─────────────────────────────────────── */
router.get("/access/prompt/:id", async (req, res): Promise<void> => {
  const promptId = parseInt(req.params.id as string, 10);
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    res.json({ hasAccess: false, reason: "unauthenticated", freePromptsRemaining: 3, priceCents: 500 });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (!user) {
    res.json({ hasAccess: false, reason: "unauthenticated", freePromptsRemaining: 3, priceCents: 500 });
    return;
  }

  // Author (or firm owner) always has access to their own prompts
  const [promptForAuth] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (promptForAuth) {
    const [promptAuthor] = await db.select().from(usersTable).where(eq(usersTable.username, promptForAuth.authorUsername));
    if (promptAuthor && (promptAuthor.clerkUserId === clerkUserId || promptAuthor.ownerClerkUserId === clerkUserId)) {
      res.json({ hasAccess: true, reason: "author", freePromptsRemaining: Math.max(0, 3 - user.freePromptsUsed), priceCents: 0 });
      return;
    }
  }

  // Direct purchase (paid or free)
  const [directPurchase] = await db
    .select()
    .from(purchasesTable)
    .where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, promptId)));

  if (directPurchase) {
    const reason = directPurchase.priceCents === 0 ? "free" : "purchased";
    res.json({ hasAccess: true, reason, freePromptsRemaining: Math.max(0, 3 - user.freePromptsUsed), priceCents: 0 });
    return;
  }

  // Library purchase covering this prompt
  const libRows = await db.select({ libraryId: libraryPromptsTable.libraryId }).from(libraryPromptsTable).where(eq(libraryPromptsTable.promptId, promptId));
  if (libRows.length > 0) {
    const libPurchases = await db
      .select()
      .from(purchasesTable)
      .where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "library"), inArray(purchasesTable.itemId, libRows.map((l) => l.libraryId))));
    if (libPurchases.length > 0) {
      res.json({ hasAccess: true, reason: "library", freePromptsRemaining: Math.max(0, 3 - user.freePromptsUsed), priceCents: 0 });
      return;
    }
  }

  // Get author's pricing
  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  const [author] = prompt ? await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername)) : [];
  const priceCents = author?.promptPriceCents ?? 500;
  const freeRemaining = Math.max(0, 3 - user.freePromptsUsed);

  if (user.freePromptsUsed < 3) {
    res.json({ hasAccess: false, reason: "free_available", freePromptsRemaining: freeRemaining, priceCents });
    return;
  }

  res.json({ hasAccess: false, reason: "limit_reached", freePromptsRemaining: 0, priceCents });
});

/* ── POST /api/access/free-use/:id ──────────────────────────────────── */
router.post("/access/free-use/:id", async (req, res): Promise<void> => {
  const promptId = parseInt(req.params.id as string, 10);
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Already recorded? idempotent
  const [existing] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, promptId)));
  if (existing) {
    res.json({ success: true, freePromptsRemaining: Math.max(0, 3 - user.freePromptsUsed) });
    return;
  }

  if (user.freePromptsUsed >= 3) { res.status(403).json({ error: "Free prompt limit reached" }); return; }

  await db.insert(purchasesTable).values({ clerkUserId, itemType: "prompt", itemId: promptId, priceCents: 0 });
  await db.update(usersTable).set({ freePromptsUsed: user.freePromptsUsed + 1 }).where(eq(usersTable.clerkUserId, clerkUserId));

  res.json({ success: true, freePromptsRemaining: Math.max(0, 2 - user.freePromptsUsed) });
});

/* ── GET /api/access/library/:id ─────────────────────────────────────── */
router.get("/access/library/:id", async (req, res): Promise<void> => {
  const libraryId = parseInt(req.params.id as string, 10);
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    res.json({ hasAccess: false, reason: "unauthenticated", priceCents: 10000 });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (!user) { res.json({ hasAccess: false, reason: "unauthenticated", priceCents: 10000 }); return; }

  const [purchase] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.clerkUserId, clerkUserId), eq(purchasesTable.itemType, "library"), eq(purchasesTable.itemId, libraryId)));
  if (purchase) { res.json({ hasAccess: true, reason: "purchased", priceCents: 0 }); return; }

  const [library] = await db.select().from(librariesTable).where(eq(librariesTable.id, libraryId));
  const [author] = library ? await db.select().from(usersTable).where(eq(usersTable.username, library.authorUsername)) : [];

  // Author / firm owner always has access
  if (author && clerkUserId && (author.clerkUserId === clerkUserId || author.ownerClerkUserId === clerkUserId || (author.adminClerkUserIds ?? []).includes(clerkUserId))) {
    res.json({ hasAccess: true, reason: "author", priceCents: 0 }); return;
  }

  // Collection price: library override first, then author default
  const priceCents = library?.priceCents ?? author?.collectionPriceCents ?? 10000;

  res.json({ hasAccess: false, reason: "not_purchased", priceCents });
});

/* ── POST /api/checkout/prompt/:id ──────────────────────────────────── */
router.post("/checkout/prompt/:id", async (req, res): Promise<void> => {
  const promptId = parseInt(req.params.id as string, 10);
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Authentication required" }); return; }

  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  const [author] = prompt ? await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername)) : [];
  const priceCents = author?.promptPriceCents ?? 500;

  const planId = await resolvePlanId(priceCents);
  const baseUrl = `https://${(process.env.REPLIT_DOMAINS ?? "localhost").split(",")[0]}`;
  const redirectUrl = `${baseUrl}/payment-success?item_type=prompt&item_id=${promptId}`;

  const config = await whopApi("POST", "/api/v1/checkout_configurations", {
    plan_id: planId,
    redirect_url: redirectUrl,
    metadata: { clerk_user_id: clerkUserId, item_type: "prompt", item_id: String(promptId), price_cents: String(priceCents) },
  });

  if (!config?.purchase_url) { res.status(500).json({ error: "Failed to create checkout" }); return; }
  res.json({ purchaseUrl: config.purchase_url, checkoutConfigId: config.id, priceCents });
});

/* ── POST /api/checkout/library/:id ─────────────────────────────────── */
router.post("/checkout/library/:id", async (req, res): Promise<void> => {
  const libraryId = parseInt(req.params.id as string, 10);
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Authentication required" }); return; }

  const [library] = await db.select().from(librariesTable).where(eq(librariesTable.id, libraryId));
  const [author] = library ? await db.select().from(usersTable).where(eq(usersTable.username, library.authorUsername)) : [];
  // Collection price: library override first, then author default
  const priceCents = library?.priceCents ?? author?.collectionPriceCents ?? 10000;

  const planId = await resolvePlanId(priceCents);
  const baseUrl = `https://${(process.env.REPLIT_DOMAINS ?? "localhost").split(",")[0]}`;
  const redirectUrl = `${baseUrl}/payment-success?item_type=library&item_id=${libraryId}`;

  const config = await whopApi("POST", "/api/v1/checkout_configurations", {
    plan_id: planId,
    redirect_url: redirectUrl,
    metadata: { clerk_user_id: clerkUserId, item_type: "library", item_id: String(libraryId), price_cents: String(priceCents) },
  });

  if (!config?.purchase_url) { res.status(500).json({ error: "Failed to create checkout" }); return; }
  res.json({ purchaseUrl: config.purchase_url, checkoutConfigId: config.id, priceCents });
});

/* ── POST /api/whop/verify ───────────────────────────────────────────── */
router.post("/whop/verify", async (req, res): Promise<void> => {
  const { checkoutConfigId } = req.body as { checkoutConfigId?: string };
  const { userId: callerClerkUserId } = getAuth(req);

  if (!checkoutConfigId) { res.status(400).json({ error: "checkoutConfigId required" }); return; }
  if (!callerClerkUserId) { res.status(401).json({ error: "Authentication required to verify purchase" }); return; }

  // Retrieve checkout config for metadata
  const configData = await whopApi("GET", `/api/v1/checkout_configurations/${checkoutConfigId}`);
  const metadata = configData?.metadata ?? {};

  const storedClerkUserId: string = metadata.clerk_user_id ?? "";
  const itemType: string = metadata.item_type ?? "";
  const itemId = parseInt(metadata.item_id ?? "0", 10);
  const priceCents = parseInt(metadata.price_cents ?? "0", 10);

  if (!storedClerkUserId || !itemType || !itemId) {
    res.status(400).json({ error: "Invalid checkout metadata" });
    return;
  }

  // Security: authenticated caller must be the user who initiated checkout
  if (storedClerkUserId !== callerClerkUserId) {
    res.status(403).json({ error: "Checkout does not belong to this account" });
    return;
  }

  // Verify at least one succeeded payment for this config
  const paymentsData = await whopApi("GET", `/api/v1/payments?checkout_configuration_ids[]=${checkoutConfigId}&first=10`);
  const payments: any[] = paymentsData?.data ?? [];
  const succeeded = payments.find((p) => p.status === "paid" || p.status === "succeeded");

  if (!succeeded) {
    res.status(400).json({ error: "No successful payment found" });
    return;
  }

  // Idempotent: skip if already recorded for this checkout
  const [existing] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.clerkUserId, storedClerkUserId), eq(purchasesTable.itemType, itemType), eq(purchasesTable.itemId, itemId), eq(purchasesTable.whopCheckoutConfigId, checkoutConfigId)));
  if (!existing) {
    await db.insert(purchasesTable).values({ clerkUserId: storedClerkUserId, itemType, itemId, whopCheckoutConfigId: checkoutConfigId, priceCents });
  }

  res.json({ success: true, itemType, itemId });
});


export default router;
