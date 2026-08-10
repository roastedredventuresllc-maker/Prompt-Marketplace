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
 * Reads an `Authorization: Bearer sk_...` header and resolves it to the
 * matching api_keys row.  Sets req.apiKey if valid and active; otherwise
 * leaves it undefined (the route handler decides whether to 401 or fall
 * through to Clerk session auth).
 */
export async function bearerAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer sk_")) {
    return next();
  }

  const rawKey = authHeader.slice(7); // strip "Bearer "
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
