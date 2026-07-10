---
name: Whop paywall integration
description: How the Whop paywall is wired in Promptly — plans, checkout, access check, and content gating patterns.
---

## Key IDs (Promptly Whop account)
- Company: `biz_tS4fzomuhFr7qv`
- Product: `prod_O9RuGmzn0dt7G` ("Promptly")
- Prompt plan (one-time $5): `plan_8ika5j5J2tohe`
- Collection plan (one-time $100): `plan_PbcIyC0wLtXWO`
- All stored as env vars: WHOP_COMPANY_ID, WHOP_PROMPT_PLAN_ID, WHOP_COLLECTION_PLAN_ID

## Access model
- `purchases` table: records all access (paid + free, price_cents=0 for free)
- Free tier: 3 prompts per user; tracked via `users.free_prompts_used` + purchases rows
- Library purchase unlocks all prompts inside that library
- `POST /api/access/free-use/:id` — explicitly records free use (intentional, not on load)

## Server-side content gating
- `GET /api/prompts/:id` checks `checkPromptAccess(clerkUserId, promptId)`
- If no access: returns truncated content (~120 chars) + `isGated: true` in response
- `checkPromptAccess` only returns true for recorded purchases (not free-tier-pending)
- After free-use recorded, next GET returns full content

## Checkout flow
- `POST /api/checkout/prompt/:id` or `POST /api/checkout/library/:id`
- Creates a Whop checkout config with metadata: { clerk_user_id, item_type, item_id, price_cents }
- Returns { purchaseUrl, checkoutConfigId, priceCents }
- Redirect URL: `/payment-success?item_type=X&item_id=Y` (Whop appends checkout params)
- After payment: `POST /api/whop/verify` with checkoutConfigId from URL params
- Verify endpoint: requires auth, checks caller matches metadata.clerk_user_id, verifies payment status via Whop REST, records purchase idempotently

## PaywallGate component
- Fetches access status from GET /api/access/prompt/:id
- States: unauthenticated → sign-up CTA | free_available → "Use 1 free prompt" | limit_reached → buy buttons
- `onAccessGranted` callback lets parent re-fetch prompt (invalidate React Query cache)
- After free-use: calls onAccessGranted → parent invalidates getGetPromptQueryKey(promptId) → server now returns full content

**Why:** Whop verify must be server-side (not trust client redirect params). Content must be gated server-side (truncated in API response, not just blurred in frontend).

**How to apply:** For new gated content types, follow the same pattern: purchases table + checkPromptAccess helper + truncation in API response + PaywallGate on frontend.
