---
name: Username cascade on rename
description: When a user changes their username, related tables must be updated atomically
---

## Rule

`prompts.authorUsername` and `libraries.authorUsername` are denormalized foreign keys. When `users.username` changes, both must be updated in the same request.

**Pattern (users.ts PATCH handler):**
```ts
// After successful users.update:
if (updates.username && updates.username !== params.data.username) {
  await db.update(promptsTable).set({ authorUsername: updates.username }).where(eq(promptsTable.authorUsername, params.data.username));
  await db.update(librariesTable).set({ authorUsername: updates.username }).where(eq(librariesTable.authorUsername, params.data.username));
}
```

Also catch unique-constraint violations (PG error code `23505`) from concurrent renames and return 409 instead of 500:
```ts
} catch (err: any) {
  if (err?.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
  throw err;
}
```

**Why:** Without the cascade, authored content becomes detached after rename, breaking profile listings, author bypass logic, and collection lookups.
