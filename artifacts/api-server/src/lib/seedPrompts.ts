import { db } from "@workspace/db";
import { promptsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import usersData from "./seed-data/users.json";
import promptsData from "./seed-data/prompts.json";

type SeedUser = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  categories: string[];
  orgType: "individual" | "firm";
  orgName: string | null;
};

type SeedPrompt = {
  title: string;
  description: string | null;
  content: string;
  categoryId: number;
  subcategoryId: number | null;
  tags: string[];
  authorUsername: string;
  saveCount: number;
  viewCount: number;
};

export async function seedPrompts(): Promise<void> {
  // Ensure every seed author exists. Skip usernames that already exist so we
  // never clobber a real signed-up user or admin edits to a seed firm profile.
  for (const user of usersData as SeedUser[]) {
    await db.insert(usersTable).values(user).onConflictDoNothing();
  }

  // Insert each prompt only if a prompt with that exact title doesn't already exist.
  for (const prompt of promptsData as SeedPrompt[]) {
    const [existing] = await db
      .select({ id: promptsTable.id })
      .from(promptsTable)
      .where(eq(promptsTable.title, prompt.title))
      .limit(1);

    if (!existing) {
      await db.insert(promptsTable).values({
        ...prompt,
        isPublic: true,
      });
    }
  }
}
