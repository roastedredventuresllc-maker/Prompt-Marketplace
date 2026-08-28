import type { Request } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  promptsTable,
  usersTable,
  purchasesTable,
  libraryPromptsTable,
  librariesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

/** Clerk user id from a session cookie or from a Bearer API key. */
export function getCallerClerkUserId(req: Request): string | null {
  const fromKey = req.apiKey?.ownerClerkUserId;
  if (fromKey) return fromKey;
  const { userId } = getAuth(req);
  return userId ?? null;
}

function isAuthorOrAdmin(
  author: typeof usersTable.$inferSelect | undefined,
  clerkUserId: string,
): boolean {
  if (!author) return false;
  if (author.clerkUserId === clerkUserId || author.ownerClerkUserId === clerkUserId) return true;
  return (author.adminClerkUserIds ?? []).includes(clerkUserId);
}

/**
 * Batch access check for prompt bodies.
 * Access if the caller is the author / firm owner / firm admin,
 * has a direct prompt purchase, or purchased a library that contains the prompt.
 */
export async function getAccessiblePromptIds(
  clerkUserId: string | null,
  promptIds: number[],
): Promise<Set<number>> {
  const accessible = new Set<number>();
  if (!clerkUserId || promptIds.length === 0) return accessible;

  const uniqueIds = [...new Set(promptIds)];

  const promptRows = await db
    .select({ id: promptsTable.id, authorUsername: promptsTable.authorUsername })
    .from(promptsTable)
    .where(inArray(promptsTable.id, uniqueIds));

  const usernames = [...new Set(promptRows.map((p) => p.authorUsername))];
  const authors = usernames.length
    ? await db.select().from(usersTable).where(inArray(usersTable.username, usernames))
    : [];
  const authorByUsername = new Map(authors.map((a) => [a.username, a]));

  for (const p of promptRows) {
    if (isAuthorOrAdmin(authorByUsername.get(p.authorUsername), clerkUserId)) {
      accessible.add(p.id);
    }
  }

  const remaining = uniqueIds.filter((id) => !accessible.has(id));
  if (remaining.length === 0) return accessible;

  const direct = await db
    .select({ itemId: purchasesTable.itemId })
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, clerkUserId),
        eq(purchasesTable.itemType, "prompt"),
        inArray(purchasesTable.itemId, remaining),
      ),
    );
  for (const row of direct) accessible.add(row.itemId);

  const stillRemaining = remaining.filter((id) => !accessible.has(id));
  if (stillRemaining.length === 0) return accessible;

  const libRows = await db
    .select({
      libraryId: libraryPromptsTable.libraryId,
      promptId: libraryPromptsTable.promptId,
    })
    .from(libraryPromptsTable)
    .where(inArray(libraryPromptsTable.promptId, stillRemaining));

  if (libRows.length === 0) return accessible;

  const libraryIds = [...new Set(libRows.map((l) => l.libraryId))];
  const libPurchases = await db
    .select({ itemId: purchasesTable.itemId })
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, clerkUserId),
        eq(purchasesTable.itemType, "library"),
        inArray(purchasesTable.itemId, libraryIds),
      ),
    );
  const purchasedLibs = new Set(libPurchases.map((p) => p.itemId));
  for (const row of libRows) {
    if (purchasedLibs.has(row.libraryId)) accessible.add(row.promptId);
  }

  return accessible;
}

export async function checkPromptAccess(
  clerkUserId: string | null,
  promptId: number,
): Promise<boolean> {
  const set = await getAccessiblePromptIds(clerkUserId, [promptId]);
  return set.has(promptId);
}

export async function checkLibraryAccess(
  clerkUserId: string | null,
  libraryId: number,
): Promise<boolean> {
  if (!clerkUserId) return false;

  const [library] = await db.select().from(librariesTable).where(eq(librariesTable.id, libraryId));
  if (!library) return false;

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, library.authorUsername));
  if (isAuthorOrAdmin(author, clerkUserId)) return true;

  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(
      and(
        eq(purchasesTable.clerkUserId, clerkUserId),
        eq(purchasesTable.itemType, "library"),
        eq(purchasesTable.itemId, libraryId),
      ),
    );
  return !!purchase;
}
