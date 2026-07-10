---
name: Auth/ownership patterns for mutating endpoints
description: Correct guard order for Clerk-authenticated PATCH routes that must enforce ownership
---

## Rule

Every mutating endpoint (PATCH, DELETE) that modifies user-owned data must:

1. Call `getAuth(req)` immediately.
2. Return 401 if `!userId` — **before** any DB reads.
3. Fetch the target row, return 404 if missing.
4. Compare `target.clerkUserId === userId || target.ownerClerkUserId === userId`, return 403 if neither matches.
5. Then proceed with the update.

**Wrong pattern** (caused a critical bug):
```ts
if (userId && target.clerkUserId !== userId) { return 403; }
// ^ if userId is null/undefined, this silently allows unauthenticated updates
```

**Correct pattern**:
```ts
if (!userId) { return 401; }
if (target.clerkUserId !== userId && target.ownerClerkUserId !== userId) { return 403; }
```

**Why:** The `&&` short-circuit means unauthenticated callers skip the ownership check entirely. Always guard unauthenticated requests with an explicit early return.

**How to apply:** Review every `router.patch` / `router.delete` that touches user-owned rows. The pattern was applied to `PATCH /users/:username` and `PATCH /prompts/:id`.
