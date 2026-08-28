import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function splitAllowlist(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export async function isPlatformAdmin(clerkUserId: string) {
  const clerkIds = splitAllowlist(process.env.PLATFORM_ADMIN_CLERK_USER_IDS);
  if (clerkIds.has(clerkUserId)) return true;

  const [user] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));

  if (!user) return false;

  const configuredUsernames = splitAllowlist(process.env.PLATFORM_ADMIN_USERNAMES);
  const adminUsernames = configuredUsernames.size > 0
    ? configuredUsernames
    : new Set(["jones"]);

  return adminUsernames.has(user.username);
}