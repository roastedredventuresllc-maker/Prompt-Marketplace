---
name: Users and LibraryDetail schema facts
description: Users table has no prompt_count/total_saves columns; LibraryDetail type uses prompts array not promptCount field
---

**Users table actual columns:** id, username, display_name, bio, avatar_url, categories, created_at, clerk_user_id, org_type, org_name. No `prompt_count` or `total_saves` — the API computes these dynamically in `buildUserResponse` by querying the prompts table.

**LibraryDetail type:** Has `prompts: Prompt[]` (the full prompt objects), NOT a `promptCount: number` field. Use `library.prompts?.length ?? 0` for the count display.

**Why:** Cached columns were never added to the schema; dynamic computation is the intended pattern. LibraryDetail was designed to include the full prompt list so no separate count field was added.

**How to apply:** Never write `UPDATE users SET prompt_count = ...` — that column does not exist. Never reference `library.promptCount` — use `library.prompts.length`.
