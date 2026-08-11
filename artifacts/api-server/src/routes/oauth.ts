/**
 * OAuth 2.0 Authorization Code flow (with PKCE) for Claude.ai MCP connector.
 *
 * Endpoints (all under /api/oauth):
 *   POST /api/oauth/register   – Dynamic Client Registration (RFC 7591)
 *   POST /api/oauth/code       – Internal: frontend calls this after user approves
 *   POST /api/oauth/token      – Exchange auth code for access_token
 */

import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, apiKeysTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

// ── In-memory stores (short-lived; suitable for auth codes + client registry) ─

type OAuthClient = {
  clientId: string;
  redirectUris: string[];
  clientName: string;
};

type AuthCode = {
  code: string;
  clerkUserId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number; // epoch ms
};

const clients = new Map<string, OAuthClient>();
const authCodes = new Map<string, AuthCode>();

// Clean expired codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authCodes) {
    if (v.expiresAt < now) authCodes.delete(k);
  }
}, 60_000);

// ── Dynamic Client Registration ───────────────────────────────────────────────

router.post("/oauth/register", (req, res) => {
  const { redirect_uris = [], client_name = "OAuth Client" } = req.body ?? {};
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({ error: "invalid_redirect_uri", error_description: "redirect_uris is required" });
    return;
  }

  const clientId = "claude_" + randomBytes(12).toString("hex");
  clients.set(clientId, { clientId, redirectUris: redirect_uris, clientName: client_name });

  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris,
    client_name,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

// ── Internal: frontend POSTs here after user clicks Authorize ─────────────────

router.post("/oauth/code", async (req, res): Promise<void> => {
  const { userId } = getAuth(req as any);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { clientId, redirectUri, codeChallenge, codeChallengeMethod } = req.body ?? {};
  if (!codeChallenge) {
    res.status(400).json({ error: "Missing codeChallenge" });
    return;
  }

  const code = randomBytes(24).toString("hex");
  authCodes.set(code, {
    code,
    clerkUserId: userId,
    clientId: clientId ?? "",
    redirectUri: redirectUri ?? "",
    codeChallenge,
    codeChallengeMethod: codeChallengeMethod ?? "S256",
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  res.json({ code });
});

// ── Token endpoint ────────────────────────────────────────────────────────────

router.post("/oauth/token", async (req, res): Promise<void> => {
  const { grant_type, code, code_verifier, redirect_uri, client_id } = req.body ?? {};

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const stored = authCodes.get(code);
  if (!stored || stored.expiresAt < Date.now()) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code not found or expired" });
    return;
  }

  // PKCE verification
  if (stored.codeChallengeMethod === "S256") {
    const expected = createHash("sha256")
      .update(code_verifier ?? "")
      .digest("base64url");
    if (expected !== stored.codeChallenge) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      return;
    }
  }

  authCodes.delete(code);

  // Find or create an API key for this user
  const clerkUserId = stored.clerkUserId;

  // First try to find an existing active key
  const [existingKey] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.ownerClerkUserId, clerkUserId), eq(apiKeysTable.isActive, true)))
    .limit(1);

  let rawKey: string;

  if (existingKey) {
    // We can't return the raw key (it's hashed) — issue a fresh one named "Claude"
    // and mark it so we know it came from OAuth
  }

  // Always create a fresh key for OAuth sessions so Claude has its own key
  rawKey = "sk_" + randomBytes(32).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 10);

  await db.insert(apiKeysTable).values({
    ownerClerkUserId: clerkUserId,
    keyHash,
    keyPrefix,
    name: "Claude (auto)",
    creditsCents: 0,
    isActive: true,
  });

  res.json({
    access_token: rawKey,
    token_type: "bearer",
    expires_in: 3600 * 24 * 365, // 1 year
  });
});

export default router;
