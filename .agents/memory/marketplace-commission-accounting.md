---
name: Marketplace commission accounting
description: Durable financial rules for Promptly purchases, credit top-ups, and sales reporting.
---

Every successful paid marketplace transaction records immutable gross, platform commission, and net amounts. The platform commission is 5%, rounded to the nearest cent. Free, failed, duplicate, and already-owned transactions do not create commission.

**Why:** Financial reporting and creator earnings must reconcile from stored transaction values instead of recalculating historical amounts under potentially changed rules.

**How to apply:** Use the shared commission calculation for prompt sales, collection sales, and API-credit purchases. A paid API top-up grants 95% of its gross amount as credits; spending those credits on content is a separate marketplace transaction with its own 5% commission. Whop verification must deduplicate by checkout configuration ID before granting access or credits.