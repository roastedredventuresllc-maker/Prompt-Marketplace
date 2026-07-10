---
name: Profile hooks queryKey requirement
description: useListPrompts and useGetUserLibraries fail typecheck when passed enabled:boolean without a queryKey in query options
---

When calling `useListPrompts` or `useGetUserLibraries` with a conditional `enabled` flag, the generated Orval hooks **require** an explicit `queryKey` in the `query` options — otherwise TypeScript reports a missing required property error.

**Why:** The generated hook type for `UseQueryOptions` marks `queryKey` as required when overriding query options. The default `??` in the hook implementation fills it at runtime, but the TS signature still requires it at the call site.

**How to apply:** Always import the queryKey generators alongside the hook:
```typescript
import {
  useListPrompts, getListPromptsQueryKey,
  useGetUserLibraries, getGetUserLibrariesQueryKey,
} from "@workspace/api-client-react";

const params = { username: safeUsername, limit: 24 };
useListPrompts(params, { query: { enabled: ..., queryKey: getListPromptsQueryKey(params) } });
useGetUserLibraries(username, { query: { enabled: ..., queryKey: getGetUserLibrariesQueryKey(username) } });
```
