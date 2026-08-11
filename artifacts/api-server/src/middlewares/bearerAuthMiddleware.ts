import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Augment Express Request so routes can read req.apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: typeof apiKeysTable.$inferSelect;
    }
  }
}

/**
 * Resolves an API key to req.apiKey.  Accepts the key two ways:
 *   1. Authorization: Bearer sk_...  header  (standard agent use)
 *   2. ?key=sk_...  query parameter           (Claude.ai connector — URL only, no header field)
 * Sets req.apiKey if valid and active; otherwise leaves it undefined.
 */
export async function bearerAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryKey = typeof req.query.key === "string" ? req.query.key : undefined;

  // Pick whichever source is present; header takes priority
  const rawKey = authHeader?.startsWith("Bearer sk_")
    ? authHeader.slice(7)
    : queryKey?.startsWith("sk_")
      ? queryKey
      : null;

  if (!rawKey) return next();
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const [apiKey] = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyHash, keyHash));

  if (apiKey?.isActive) {
    req.apiKey = apiKey;
    // Fire-and-forget: stamp last_used_at without blocking the request
    db.update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, apiKey.id))
      .catch(() => {});
  }

  next();
}
