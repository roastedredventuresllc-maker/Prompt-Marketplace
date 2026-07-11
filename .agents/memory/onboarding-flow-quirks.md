---
name: Onboarding flow quirks (Promptly)
description: Redirect-to-onboarding pattern loses original intent unless explicitly preserved; "/profile/me" is a placeholder route, not a real username.
---

- Several pages (create-prompt, settings) redirect a signed-in-but-not-yet-onboarded Clerk user to `/onboarding` when `GET /api/users/me` 404s. Onboarding's `createUser` success handler used to always navigate to `/profile/:username`, stranding users who were trying to do something else (e.g. create a prompt). Fixed by having callers write `sessionStorage.setItem("onboardingReturnTo", <path>)` before redirecting, and onboarding reads/clears it on success, falling back to `/profile/:username`.
  **Why:** onboarding is a shared interstitial triggered from multiple entry points; hardcoding its post-submit destination silently breaks every caller except the "edit my profile" case.
  **How to apply:** any new flow that redirects into `/onboarding` due to a missing profile should set `onboardingReturnTo` first.

- `/profile/me` is a UI placeholder used before the caller's own username has loaded (e.g. header avatar link falls back to it while `useMyProfileInfo` is still fetching). The backend has no user literally named "me" — `GET /api/users/:username` for username="me" 404s, rendering "Creator not found". `edit-profile.tsx` already special-cased `username === "me"`; `profile.tsx` didn't, causing the bug.
  **Why:** the "me" fallback is an optimistic placeholder pattern, not a resolvable identity server-side.
  **How to apply:** any page keyed by `:username` from the route must treat literal `"me"` as "redirect to the real username once `/api/users/me` resolves", not pass it straight to a profile-lookup endpoint.
