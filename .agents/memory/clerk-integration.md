---
name: Clerk integration patterns for Promptly
description: How Clerk auth is wired into this project — imports, component API, security rules
---

## Import patterns
- Frontend: `import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react"`
- Frontend publishableKey: `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` from `@clerk/react/internal`
- API server: `import { clerkMiddleware, getAuth } from "@clerk/express"` + `import { publishableKeyFromHost } from "@clerk/shared/keys"`
- Themes: `import { shadcn } from "@clerk/themes"` — this is an object, not a string

## Auth-conditional components
- Use `<Show when="signed-in">` and `<Show when="signed-out">` — NOT `<SignedIn>` / `<SignedOut>` (not exported from @clerk/react in this version)

## Security rules
- NEVER accept `clerkUserId` from request body — always derive from `getAuth(req).userId`
- Mutating endpoints should check ownership via Clerk session (write endpoints still TODO)

## Proxy URL
- `clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL` — empty in dev (intentional), auto-set in prod. Never gate on NODE_ENV.

## CSS layers (Tailwind v4)
- `@layer theme, base, clerk, components, utilities;` must come BEFORE `@import 'tailwindcss'`
- Add `@import '@clerk/themes/shadcn.css'` after tailwindcss import
- Set `tailwindcss({ optimize: false })` in vite.config.ts to prevent prod CSS layer reordering

**Why:** These Clerk-specific patterns differ from standard Clerk docs — Replit-managed Clerk has specific proxy and key-resolution requirements.
