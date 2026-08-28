/**
 * MCP (Model Context Protocol) server — HTTP stateless transport.
 *
 * POST /api/mcp
 *   Auth: Authorization: Bearer sk_...  (or ?key=sk_... query param)
 *   Body: JSON-RPC 2.0 request
 *   Response: JSON-RPC 2.0 response
 *
 * GET  /api/mcp
 *   Discovery document (no auth). Tool calls are POST only.
 *
 * ── Tools ─────────────────────────────────────────────────────────────────
 * Browse & orient (no auth)
 *   whoami                  Who am I? (auth)
 *   list_categories         All categories with prompt counts
 *   list_tags               Top tags by usage
 *   list_authors            Top authors sorted by prompt count or saves
 *   get_author              Full author profile by handle
 *   search_prompts          Full-text search + filter + sort + pagination
 *   get_prompt              Metadata + preview; full text if owned/purchased
 *   get_similar             Related prompts by tag overlap
 *   get_prompt_stats        Purchase count, save-to-purchase rate, last sale
 *   list_reviews            All ratings/reviews for a prompt
 *
 * Save & collect (auth required)
 *   save_prompt             Bookmark a prompt to your library
 *   unsave_prompt           Remove a bookmark
 *   list_saved              Your bookmarked prompts
 *   create_collection       Create a named collection
 *   add_to_collection       Add a prompt to one of your collections
 *   list_collections        Your collections
 *
 * Evaluate (auth for write)
 *   create_review           Rate and review a prompt (auth)
 *
 * Utilities (no auth)
 *   validate_prompt         Detect placeholder issues before publishing
 *   extract_variables       List placeholders from prompt text
 *
 * Authoring (auth required)
 *   list_my_prompts         Your published/draft prompts
 *   create_prompt           Publish a new prompt (invite-only)
 *   create_prompts_bulk     Publish multiple prompts (invite-only)
 *   update_prompt           Edit a prompt you own
 *   delete_prompt           Soft-delete a prompt you own
 *   fork_prompt             Clone a prompt you own or purchased into a draft
 *
 * Economics & session (auth required)
 *   get_balance             API key credit balance
 *   purchase_prompt         Buy a prompt with credits
 *   list_purchased          Prompts you've bought
 *   get_earnings            Revenue, per-prompt breakdown
 *   list_transactions       Full purchase / sale history
 */

import { Router } from "express";
import {
  db,
  promptsTable, categoriesTable, usersTable,
  purchasesTable, apiKeysTable,
  libraryPromptsTable, librariesTable,
  savesTable, ratingsTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, isNull, ilike, or } from "drizzle-orm";
import { calculateTransactionAmounts } from "../lib/commission";
import { checkPromptAccess } from "../lib/promptAccess";
import { AUTH_REQUIRED, MCP_SURFACES, sendMcpDiscovery } from "../lib/mcpDiscovery";
import { canAddPromptToLibrary } from "../lib/contentGate";

const router: Router = Router();

// ── Helper types ──────────────────────────────────────────────────────────

type ApiKey = typeof apiKeysTable.$inferSelect;

// ── Tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  // ── Session ──
  {
    name: "whoami",
    description: "Returns the Promptly account linked to this API key: handle, display name, plan, prompt count, and whether this key can publish.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Browse ──
  {
    name: "list_categories",
    description: "List all categories in the Promptly catalog with their slug (use for filtering) and prompt count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_category",
    description: "Create a new top-level category in the Promptly catalog. Use list_categories first to avoid duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name, e.g. 'Personal & Everyday'" },
        slug: { type: "string", description: "URL-safe slug, e.g. 'personal-everyday'. Auto-generated from name if omitted." },
        description: { type: "string", description: "One-sentence description shown on the category page." },
        icon: { type: "string", description: "Lucide icon name (default: Sparkles)" },
      },
      required: ["name"],
    },
  },

  {
    name: "list_tags",
    description: "Top tags across the catalog ordered by usage. Use to build a tag cloud or discover popular topics.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max tags to return (1–200, default 50)" },
      },
    },
  },
  {
    name: "list_authors",
    description: "List creators on the platform sorted by prompt count or total saves.",
    inputSchema: {
      type: "object",
      properties: {
        sort: { type: "string", enum: ["prompts", "saves"], description: "Sort order: 'prompts' (default) or 'saves'" },
        limit: { type: "number", description: "Max results (1–50, default 20)" },
      },
    },
  },
  {
    name: "get_author",
    description: "Full profile for a creator: bio, prompt count, total saves, default pricing.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Author username / handle" },
      },
      required: ["handle"],
    },
  },
  {
    name: "search_prompts",
    description: "Search and browse the Promptly prompt catalog. Supports full-text search, category filter, sorting, and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword / full-text search across title, description, and tags" },
        category: { type: "string", description: "Filter by category slug, e.g. 'finance', 'writing', 'marketing'" },
        author: { type: "string", description: "Filter by author handle" },
        sort: { type: "string", enum: ["saves", "recent", "rating"], description: "Sort order (default: saves)" },
        limit: { type: "number", description: "Results per page (1–50, default 20)" },
        offset: { type: "number", description: "Skip N results for pagination (default 0)" },
      },
    },
  },
  {
    name: "get_prompt",
    description: "Metadata + content preview for one prompt (300-char preview). Authenticated owners and purchasers receive full `content`. Otherwise call purchase_prompt to unlock.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_similar",
    description: "Prompts similar to a given prompt based on tag overlap. Useful for cross-sell or discovery.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Source prompt ID" },
        limit: { type: "number", description: "Max results (1–20, default 6)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_prompt_stats",
    description: "Social proof stats for a prompt: purchase count, save-to-purchase conversion rate, and when it was last bought.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_reviews",
    description: "All ratings and written reviews for a prompt, newest first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID" },
        limit: { type: "number", description: "Max results (1–50, default 20)" },
      },
      required: ["id"],
    },
  },

  // ── Save / collect ──
  {
    name: "save_prompt",
    description: "Bookmark a prompt to your personal saved library. Does not purchase — use purchase_prompt for that.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to save" },
      },
      required: ["id"],
    },
  },
  {
    name: "unsave_prompt",
    description: "Remove a bookmark from your saved library.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to unsave" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_saved",
    description: "List all prompts you have bookmarked.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1–100, default 50)" },
      },
    },
  },
  {
    name: "create_collection",
    description: "Create a named collection to organise prompts (e.g. 'My cold outreach stack').",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Collection name" },
        description: { type: "string", description: "Optional description" },
        isPublic: { type: "boolean", description: "Whether it is publicly visible (default true)" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_to_collection",
    description: "Add a prompt to one of your collections.",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "number", description: "Collection ID (from list_collections)" },
        promptId: { type: "number", description: "Prompt ID to add" },
      },
      required: ["collectionId", "promptId"],
    },
  },
  {
    name: "list_collections",
    description: "List all collections you own.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1–50, default 20)" },
      },
    },
  },

  // ── Evaluate ──
  {
    name: "create_review",
    description: "Rate and review a prompt (1–5 stars, optional written review). You must have purchased the prompt. Updates your existing review if you already left one.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID" },
        rating: { type: "number", description: "Star rating 1–5" },
        review: { type: "string", description: "Optional written review" },
      },
      required: ["id", "rating"],
    },
  },

  // ── Utilities ──
  {
    name: "validate_prompt",
    description: "Detect common authoring issues before publishing: unclosed placeholders, mixed {brace}/[bracket] syntax, missing description, title length.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Prompt title to validate" },
        content: { type: "string", description: "Prompt body to validate" },
        description: { type: "string", description: "Optional description to validate" },
      },
      required: ["content"],
    },
  },
  {
    name: "extract_variables",
    description: "Extract all placeholder variables from a prompt's content. Returns a list of variable names and their syntax style ({brace} or [bracket]).",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Prompt text to scan" },
      },
      required: ["content"],
    },
  },

  // ── Authoring ──
  {
    name: "list_my_prompts",
    description: "List prompts you have published, with view counts, save counts, purchase counts, and revenue per prompt.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1–100, default 50)" },
        offset: { type: "number", description: "Skip N results for pagination" },
        includePrivate: { type: "boolean", description: "Include unlisted/private prompts (default true)" },
      },
    },
  },
  {
    name: "create_prompt",
    description: "Publish a new prompt to the Promptly marketplace under your account. Invite-only — not a public free-for-all. An API key does not grant open publishing.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Prompt title (max 200 chars)" },
        content: { type: "string", description: "The full prompt text" },
        description: { type: "string", description: "Short description shown on listing cards" },
        categoryId: { type: "number", description: "Category ID — use list_categories to see options" },
        tags: { type: "array", items: { type: "string" }, description: "Tags (up to 10)" },
        priceCents: { type: "number", description: "Price in cents (e.g. 500 = $5.00). Omit to use your account default price." },
        isPublic: { type: "boolean", description: "Publicly listed (default true)" },
        idempotencyKey: { type: "string", description: "Optional unique key to prevent duplicates on retry. If a prompt with this key already exists for your account, it is returned instead of creating a new one." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_prompts_bulk",
    description: "Publish multiple prompts in one call. Invite-only — not a public free-for-all. Each item uses the same schema as create_prompt. Returns results per prompt including any per-item errors.",
    inputSchema: {
      type: "object",
      properties: {
        prompts: {
          type: "array",
          description: "Array of prompt objects",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              description: { type: "string" },
              categoryId: { type: "number" },
              tags: { type: "array", items: { type: "string" } },
              priceCents: { type: "number", description: "Price in cents. Omit to use account default." },
              isPublic: { type: "boolean" },
              idempotencyKey: { type: "string" },
            },
            required: ["title", "content"],
          },
        },
      },
      required: ["prompts"],
    },
  },
  {
    name: "update_prompt",
    description: "Edit a prompt you own. Only include the fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to update" },
        title: { type: "string" },
        content: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        priceCents: { type: "number", description: "Price in cents. Omit to keep current price." },
        isPublic: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_prompt",
    description: "Soft-delete a prompt you own. The prompt is removed from all listings but purchases, ratings, and collections are preserved.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "fork_prompt",
    description: "Clone a prompt you own or have purchased into a private draft under your account. Useful for remixing or building on existing prompts.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to fork" },
      },
      required: ["id"],
    },
  },

  // ── Economics ──
  {
    name: "get_balance",
    description: "Check credit balance on this API key.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "purchase_prompt",
    description: "Buy a prompt with API credits. Full content returned immediately. If already purchased, returns content at no charge.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Prompt ID to purchase" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_purchased",
    description: "List prompts you have purchased.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1–100, default 50)" },
      },
    },
  },
  {
    name: "get_earnings",
    description: "Your creator revenue: total earned, pending payout, and per-prompt breakdown sorted by revenue.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_transactions",
    description: "Full history of purchases you made (spending) and sales of your prompts (earnings), newest first.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["all", "spending", "earnings"], description: "Filter by transaction side (default: all)" },
        limit: { type: "number", description: "Max results (1–100, default 50)" },
      },
    },
  },
];

export { TOOLS };
export { AUTH_REQUIRED, MCP_SURFACES };

const advertisedTools = new Set<string>(Object.values(MCP_SURFACES).flatMap((names) => [...names]));
const definedTools = new Set<string>(TOOLS.map((t) => t.name));
if (advertisedTools.size !== definedTools.size || [...definedTools].some((n) => !advertisedTools.has(n))) {
  throw new Error("MCP_SURFACES is out of date with TOOLS — update discovery surfaces when adding MCP tools");
}

// ── Shared helpers ─────────────────────────────────────────────────────────

async function resolveUser(clerkUserId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  return user ?? null;
}

async function requireUser(clerkUserId: string): Promise<typeof usersTable.$inferSelect> {
  const user = await resolveUser(clerkUserId);
  if (!user) throw new Error("No Promptly profile found for this API key. Complete onboarding at https://prompt-marketplace99.replit.app/onboarding first.");
  return user;
}

function isOwner(user: typeof usersTable.$inferSelect, clerkUserId: string) {
  return user.clerkUserId === clerkUserId || user.ownerClerkUserId === clerkUserId;
}

// ── Browse handlers ───────────────────────────────────────────────────────

async function whoami(apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const [{ count: promptCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(and(eq(promptsTable.authorUsername, user.username), isNull(promptsTable.deletedAt)));

  return {
    handle: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    promptCount,
    defaultPriceCents: user.promptPriceCents,
    canPublish: true,
    keyPrefix: apiKey.keyPrefix,
    creditsDollars: (apiKey.creditsCents / 100).toFixed(2),
  };
}

async function listCategories() {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
  // Get prompt count per category
  const counts = await db
    .select({ categoryId: promptsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(promptsTable)
    .where(and(eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)))
    .groupBy(promptsTable.categoryId);
  const countMap = Object.fromEntries(counts.map((c) => [c.categoryId, c.count]));
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    promptCount: countMap[c.id] ?? 0,
  }));
}

async function createCategory(args: Record<string, any>, apiKey: ApiKey) {
  const name = String(args.name ?? "").trim();
  if (!name) throw new Error("name is required");

  // Auto-generate slug from name if not provided
  const slug = args.slug
    ? String(args.slug).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!slug) throw new Error("Could not generate a valid slug from the name provided");

  // Check for duplicate
  const [existing] = await db.select({ id: categoriesTable.id, slug: categoriesTable.slug })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug));
  if (existing) throw new Error(`Category with slug '${slug}' already exists (id: ${existing.id}). Use list_categories to see all categories.`);

  const maxOrder = await db
    .select({ max: sql<number>`coalesce(max(sort_order), 0)::int` })
    .from(categoriesTable);

  const [cat] = await db.insert(categoriesTable).values({
    name,
    slug,
    description: args.description ? String(args.description) : "",
    icon: args.icon ? String(args.icon) : "Sparkles",
    sortOrder: (maxOrder[0]?.max ?? 100) + 10,
  }).returning();

  return {
    success: true,
    category: { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description, icon: cat.icon },
    note: "Use this category's id in create_prompt(categoryId: ...). It will appear in list_categories immediately.",
  };
}

async function listTags(args: Record<string, any>) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 200);
  // Unnest the tags array and count occurrences
  const rows = await db.execute(sql`
    SELECT tag, count(*)::int AS usage_count
    FROM prompts, unnest(tags) AS tag
    WHERE is_public = true AND deleted_at IS NULL
    GROUP BY tag
    ORDER BY usage_count DESC
    LIMIT ${limit}
  `);
  return (rows.rows as any[]).map((r) => ({ tag: r.tag, usageCount: r.usage_count }));
}

async function listAuthors(args: Record<string, any>) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "20"), 1), 50);
  const sortBy = args.sort === "saves" ? "total_saves" : "prompt_count";

  const rows = await db.execute(sql`
    SELECT
      u.username,
      u.display_name,
      u.bio,
      u.avatar_url,
      u.prompt_price_cents,
      count(DISTINCT p.id)::int AS prompt_count,
      coalesce(sum(p.save_count), 0)::int AS total_saves
    FROM users u
    LEFT JOIN prompts p ON p.author_username = u.username
      AND p.is_public = true AND p.deleted_at IS NULL
    WHERE u.org_type = 'individual' OR u.org_type = 'firm'
    GROUP BY u.id
    ORDER BY ${sql.raw(sortBy)} DESC
    LIMIT ${limit}
  `);

  return (rows.rows as any[]).map((r) => ({
    handle: r.username,
    displayName: r.display_name,
    bio: r.bio ?? null,
    promptCount: r.prompt_count,
    totalSaves: r.total_saves,
    defaultPriceCents: r.prompt_price_cents,
  }));
}

async function getAuthor(args: Record<string, any>) {
  const handle = String(args.handle ?? "").trim();
  if (!handle) throw new Error("handle is required");

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, handle));
  if (!user) throw new Error(`Author '${handle}' not found`);

  const [stats] = await db
    .select({
      promptCount: sql<number>`count(*)::int`,
      totalSaves: sql<number>`coalesce(sum(${promptsTable.saveCount}), 0)::int`,
    })
    .from(promptsTable)
    .where(and(eq(promptsTable.authorUsername, handle), eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)));

  return {
    handle: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    categories: user.categories,
    promptCount: stats?.promptCount ?? 0,
    totalSaves: stats?.totalSaves ?? 0,
    defaultPriceCents: user.promptPriceCents,
    joinedAt: user.createdAt,
  };
}

async function searchPrompts(args: Record<string, any>) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "20"), 1), 50);
  const offset = Math.max(parseInt(args.offset ?? "0"), 0);
  const sortArg = args.sort ?? "saves";

  const orderBy =
    sortArg === "recent" ? desc(promptsTable.createdAt) :
    sortArg === "rating" ? desc(promptsTable.avgRating) :
    desc(promptsTable.saveCount);

  // Build WHERE conditions
  const conditions: any[] = [eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt)];

  if (args.query) {
    conditions.push(sql`${promptsTable.id} IN (
      SELECT id FROM prompts WHERE search_vector @@ plainto_tsquery('english', ${String(args.query)})
      UNION
      SELECT id FROM prompts WHERE lower(title) LIKE ${"%" + String(args.query).toLowerCase() + "%"}
    )`);
  }

  if (args.category) {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.slug, args.category));
    if (!cat) throw new Error(`Category '${args.category}' not found. Use list_categories to see valid slugs.`);
    conditions.push(eq(promptsTable.categoryId, cat.id));
  }

  if (args.author) {
    conditions.push(eq(promptsTable.authorUsername, String(args.author)));
  }

  const rows = await db
    .select({
      id: promptsTable.id,
      title: promptsTable.title,
      description: promptsTable.description,
      contentPreview: sql<string>`left(${promptsTable.content}, 300)`,
      tags: promptsTable.tags,
      authorUsername: promptsTable.authorUsername,
      saveCount: promptsTable.saveCount,
      priceCents: promptsTable.priceCents,
      avgRating: promptsTable.avgRating,
      ratingCount: promptsTable.ratingCount,
      categoryId: promptsTable.categoryId,
      categoryName: categoriesTable.name,
      categorySlug: categoriesTable.slug,
      createdAt: promptsTable.createdAt,
    })
    .from(promptsTable)
    .leftJoin(categoriesTable, eq(promptsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return { results: [], total: null, offset, limit };

  // Author pricing in batch
  const authorNames = [...new Set(rows.map((r) => r.authorUsername))];
  const authors = await db
    .select({ username: usersTable.username, promptPriceCents: usersTable.promptPriceCents })
    .from(usersTable)
    .where(sql`${usersTable.username} = ANY(ARRAY[${sql.join(authorNames.map((n) => sql`${n}`), sql`, `)}])`);
  const pricingByAuthor = Object.fromEntries(authors.map((a) => [a.username, a.promptPriceCents]));

  return {
    results: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      contentPreview: r.contentPreview + (r.contentPreview?.length >= 300 ? "…" : ""),
      tags: r.tags,
      author: r.authorUsername,
      category: r.categoryName ?? null,
      categorySlug: r.categorySlug ?? null,
      saves: r.saveCount,
      avgRating: Number(r.avgRating),
      ratingCount: r.ratingCount,
      priceCents: r.priceCents ?? pricingByAuthor[r.authorUsername] ?? 500,
      createdAt: r.createdAt,
    })),
    offset,
    limit,
    note: rows.length === limit ? `More results available — increment offset by ${limit} to get the next page.` : undefined,
  };
}

async function getPrompt(args: Record<string, any>, apiKey?: ApiKey) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [row] = await db
    .select({
      id: promptsTable.id,
      title: promptsTable.title,
      description: promptsTable.description,
      content: promptsTable.content,
      priceCents: promptsTable.priceCents,
      tags: promptsTable.tags,
      authorUsername: promptsTable.authorUsername,
      saveCount: promptsTable.saveCount,
      avgRating: promptsTable.avgRating,
      ratingCount: promptsTable.ratingCount,
      categoryName: categoriesTable.name,
      categorySlug: categoriesTable.slug,
      createdAt: promptsTable.createdAt,
      updatedAt: promptsTable.updatedAt,
    })
    .from(promptsTable)
    .leftJoin(categoriesTable, eq(promptsTable.categoryId, categoriesTable.id))
    .where(and(eq(promptsTable.id, id), isNull(promptsTable.deletedAt)));

  if (!row) throw new Error(`Prompt ${id} not found`);

  const [author] = await db.select({ promptPriceCents: usersTable.promptPriceCents })
    .from(usersTable).where(eq(usersTable.username, row.authorUsername));

  const preview = row.content.slice(0, 300) + (row.content.length > 300 ? "…" : "");
  const hasAccess = apiKey ? await checkPromptAccess(apiKey.ownerClerkUserId, id) : false;

  if (hasAccess) {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      content: row.content,
      contentPreview: preview,
      tags: row.tags,
      author: row.authorUsername,
      category: row.categoryName ?? null,
      categorySlug: row.categorySlug ?? null,
      saves: row.saveCount,
      avgRating: Number(row.avgRating),
      ratingCount: row.ratingCount,
      priceCents: row.priceCents ?? author?.promptPriceCents ?? 500,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isGated: false,
    };
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    contentPreview: preview,
    tags: row.tags,
    author: row.authorUsername,
    category: row.categoryName ?? null,
    categorySlug: row.categorySlug ?? null,
    saves: row.saveCount,
    avgRating: Number(row.avgRating),
    ratingCount: row.ratingCount,
    priceCents: row.priceCents ?? author?.promptPriceCents ?? 500,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isGated: true,
    note: "Use purchase_prompt to unlock full content.",
  };
}

async function getSimilar(args: Record<string, any>) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");
  const limit = Math.min(Math.max(parseInt(args.limit ?? "6"), 1), 20);

  const [source] = await db.select({ tags: promptsTable.tags, categoryId: promptsTable.categoryId })
    .from(promptsTable).where(and(eq(promptsTable.id, id), isNull(promptsTable.deletedAt)));
  if (!source) throw new Error(`Prompt ${id} not found`);

  if (source.tags.length === 0) {
    // Fall back to same category
    const rows = await db.select({
      id: promptsTable.id, title: promptsTable.title,
      description: promptsTable.description, authorUsername: promptsTable.authorUsername,
    })
      .from(promptsTable)
      .where(and(
        eq(promptsTable.categoryId, source.categoryId),
        eq(promptsTable.isPublic, true),
        isNull(promptsTable.deletedAt),
        sql`${promptsTable.id} != ${id}`,
      ))
      .orderBy(desc(promptsTable.saveCount))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, title: r.title, description: r.description ?? "", author: r.authorUsername }));
  }

  // Tag overlap using Postgres array overlap operator &&
  const rows = await db.select({
    id: promptsTable.id, title: promptsTable.title,
    description: promptsTable.description, authorUsername: promptsTable.authorUsername,
    saveCount: promptsTable.saveCount,
  })
    .from(promptsTable)
    .where(and(
      eq(promptsTable.isPublic, true),
      isNull(promptsTable.deletedAt),
      sql`${promptsTable.id} != ${id}`,
      sql`${promptsTable.tags} && ARRAY[${sql.join(source.tags.map((t) => sql`${t}`), sql`, `)}]::text[]`,
    ))
    .orderBy(desc(promptsTable.saveCount))
    .limit(limit);

  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description ?? "", author: r.authorUsername }));
}

async function getPromptStats(args: Record<string, any>) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [prompt] = await db.select({ saveCount: promptsTable.saveCount })
    .from(promptsTable).where(and(eq(promptsTable.id, id), isNull(promptsTable.deletedAt)));
  if (!prompt) throw new Error(`Prompt ${id} not found`);

  const [purchaseStats] = await db
    .select({
      purchaseCount: sql<number>`count(*)::int`,
      lastPurchasedAt: sql<Date | null>`max(created_at)`,
    })
    .from(purchasesTable)
    .where(and(eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, id)));

  const purchaseCount = purchaseStats?.purchaseCount ?? 0;
  const saves = prompt.saveCount;
  const conversionRate = saves > 0 ? ((purchaseCount / saves) * 100).toFixed(1) + "%" : "n/a";

  return {
    promptId: id,
    saves,
    purchaseCount,
    saveToPurchaseRate: conversionRate,
    lastPurchasedAt: purchaseStats?.lastPurchasedAt ?? null,
  };
}

async function listReviews(args: Record<string, any>) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");
  const limit = Math.min(Math.max(parseInt(args.limit ?? "20"), 1), 50);

  const rows = await db.select().from(ratingsTable)
    .where(eq(ratingsTable.promptId, id))
    .orderBy(desc(ratingsTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    rating: r.rating,
    review: r.review ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

// ── Save / collect handlers ───────────────────────────────────────────────

async function savePrompt(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const promptId = parseInt(args.id, 10);
  if (isNaN(promptId)) throw new Error("id must be a number");

  const [prompt] = await db.select({ title: promptsTable.title })
    .from(promptsTable).where(and(eq(promptsTable.id, promptId), isNull(promptsTable.deletedAt)));
  if (!prompt) throw new Error(`Prompt ${promptId} not found`);

  // Idempotent: skip if already saved
  const [existing] = await db.select().from(savesTable)
    .where(and(eq(savesTable.username, user.username), eq(savesTable.promptId, promptId)));
  if (existing) return { alreadySaved: true, promptId };

  await db.insert(savesTable).values({ username: user.username, promptId });
  await db.update(promptsTable).set({ saveCount: sql`${promptsTable.saveCount} + 1` }).where(eq(promptsTable.id, promptId));

  return { success: true, saved: { promptId, title: prompt.title } };
}

async function unsavePrompt(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const promptId = parseInt(args.id, 10);
  if (isNaN(promptId)) throw new Error("id must be a number");

  const [existing] = await db.select().from(savesTable)
    .where(and(eq(savesTable.username, user.username), eq(savesTable.promptId, promptId)));
  if (!existing) return { alreadyUnsaved: true, promptId };

  await db.delete(savesTable).where(and(eq(savesTable.username, user.username), eq(savesTable.promptId, promptId)));
  await db.update(promptsTable).set({ saveCount: sql`greatest(${promptsTable.saveCount} - 1, 0)` }).where(eq(promptsTable.id, promptId));

  return { success: true, promptId };
}

async function listSaved(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 100);

  const saves = await db.select({ promptId: savesTable.promptId, savedAt: savesTable.createdAt })
    .from(savesTable)
    .where(eq(savesTable.username, user.username))
    .orderBy(desc(savesTable.createdAt))
    .limit(limit);

  if (saves.length === 0) return [];

  const ids = saves.map((s) => s.promptId);
  const prompts = await db.select({ id: promptsTable.id, title: promptsTable.title, description: promptsTable.description, authorUsername: promptsTable.authorUsername })
    .from(promptsTable)
    .where(sql`${promptsTable.id} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[])`);
  const byId = Object.fromEntries(prompts.map((p) => [p.id, p]));

  return saves.map((s) => {
    const p = byId[s.promptId];
    return { promptId: s.promptId, title: p?.title ?? "Unknown", description: p?.description ?? "", author: p?.authorUsername ?? "", savedAt: s.savedAt };
  });
}

async function createCollection(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const name = String(args.name ?? "").trim();
  if (!name) throw new Error("name is required");

  const [lib] = await db.insert(librariesTable).values({
    name,
    description: args.description ? String(args.description) : null,
    authorUsername: user.username,
    isPublic: args.isPublic !== undefined ? Boolean(args.isPublic) : true,
    kind: "collection",
  }).returning();

  return { success: true, collection: { id: lib.id, name: lib.name, description: lib.description, isPublic: lib.isPublic } };
}

async function addToCollection(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const collectionId = parseInt(args.collectionId, 10);
  const promptId = parseInt(args.promptId, 10);
  if (isNaN(collectionId) || isNaN(promptId)) throw new Error("collectionId and promptId must be numbers");

  const [lib] = await db.select().from(librariesTable).where(eq(librariesTable.id, collectionId));
  if (!lib) throw new Error(`Collection ${collectionId} not found`);
  if (lib.authorUsername !== user.username) throw new Error("Forbidden — you do not own this collection");

  const [prompt] = await db.select().from(promptsTable)
    .where(and(eq(promptsTable.id, promptId), isNull(promptsTable.deletedAt)));
  if (!prompt) throw new Error(`Prompt ${promptId} not found`);
  if (!canAddPromptToLibrary(lib.kind, prompt.authorUsername, lib.authorUsername)) {
    throw new Error("Forbidden — collections may only include prompts from this collection's author");
  }

  const [existing] = await db.select().from(libraryPromptsTable)
    .where(and(eq(libraryPromptsTable.libraryId, collectionId), eq(libraryPromptsTable.promptId, promptId)));
  if (existing) return { alreadyAdded: true };

  await db.insert(libraryPromptsTable).values({ libraryId: collectionId, promptId });
  return { success: true };
}

async function listCollections(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const limit = Math.min(Math.max(parseInt(args.limit ?? "20"), 1), 50);

  const libs = await db.select().from(librariesTable)
    .where(and(eq(librariesTable.authorUsername, user.username), eq(librariesTable.kind, "collection")))
    .orderBy(desc(librariesTable.createdAt))
    .limit(limit);

  // Count prompts per collection
  const counts = await Promise.all(libs.map(async (lib) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(libraryPromptsTable).where(eq(libraryPromptsTable.libraryId, lib.id));
    return { id: lib.id, count };
  }));
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]));

  return libs.map((lib) => ({
    id: lib.id,
    name: lib.name,
    description: lib.description ?? null,
    isPublic: lib.isPublic,
    promptCount: countMap[lib.id] ?? 0,
    createdAt: lib.createdAt,
  }));
}

// ── Evaluate handlers ─────────────────────────────────────────────────────

async function createReview(args: Record<string, any>, apiKey: ApiKey) {
  const promptId = parseInt(args.id, 10);
  if (isNaN(promptId)) throw new Error("id must be a number");
  const rating = parseInt(args.rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) throw new Error("rating must be 1–5");

  // Must have purchased the prompt (or be the author, for testing)
  const [prompt] = await db.select({ authorUsername: promptsTable.authorUsername })
    .from(promptsTable).where(and(eq(promptsTable.id, promptId), isNull(promptsTable.deletedAt)));
  if (!prompt) throw new Error(`Prompt ${promptId} not found`);

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  const isAuthorKey = author && isOwner(author, apiKey.ownerClerkUserId);
  if (!isAuthorKey) {
    const [purchased] = await db.select().from(purchasesTable)
      .where(and(eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId), eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, promptId)));
    if (!purchased) throw new Error("You must purchase this prompt before reviewing it.");
  }

  await db.execute(sql`
    INSERT INTO ratings (prompt_id, clerk_user_id, rating, review, created_at, updated_at)
    VALUES (${promptId}, ${apiKey.ownerClerkUserId}, ${rating}, ${args.review ?? null}, now(), now())
    ON CONFLICT (prompt_id, clerk_user_id) DO UPDATE
      SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = now()
  `);

  // Recompute denormalized avg/count
  await db.execute(sql`
    UPDATE prompts
    SET avg_rating = (SELECT avg(rating) FROM ratings WHERE prompt_id = ${promptId}),
        rating_count = (SELECT count(*) FROM ratings WHERE prompt_id = ${promptId})
    WHERE id = ${promptId}
  `);

  return { success: true, promptId, rating, review: args.review ?? null };
}

// ── Utility handlers ──────────────────────────────────────────────────────

function validatePrompt(args: Record<string, any>) {
  const content = String(args.content ?? "");
  const title = String(args.title ?? "");
  const description = String(args.description ?? "");
  const errors: string[] = [];
  const warnings: string[] = [];

  // Unclosed braces
  const openBraces = (content.match(/\{[^}]*$/gm) ?? []).length;
  if (openBraces > 0) errors.push(`${openBraces} unclosed {brace} placeholder(s) found`);

  // Unclosed brackets
  const openBrackets = (content.match(/\[[^\]]*$/gm) ?? []).length;
  if (openBrackets > 0) errors.push(`${openBrackets} unclosed [bracket] placeholder(s) found`);

  // Mixed syntax
  const hasBraces = /\{[^}]+\}/.test(content);
  const hasBrackets = /\[[^\]]+\]/.test(content);
  if (hasBraces && hasBrackets) warnings.push("Mixed placeholder syntax: both {brace} and [bracket] styles detected. Standardise on one.");

  // Title length
  if (title && title.length > 200) errors.push(`Title is ${title.length} chars — max is 200`);

  // Missing description
  if (!description.trim()) warnings.push("No description provided. Prompts with descriptions get significantly more saves.");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function extractVariables(args: Record<string, any>) {
  const content = String(args.content ?? "");
  const braceVars = [...new Set([...content.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].trim()))];
  const bracketVars = [...new Set([...content.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()))];

  const variables = [
    ...braceVars.map((name) => ({ name, syntax: "{brace}" })),
    ...bracketVars.map((name) => ({ name, syntax: "[bracket]" })),
  ];

  return {
    variables,
    count: variables.length,
    note: variables.length > 0
      ? "Each variable is a placeholder the user should fill in before running the prompt."
      : "No placeholder variables detected.",
  };
}

// ── Authoring handlers ────────────────────────────────────────────────────

async function listMyPrompts(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 100);
  const offset = Math.max(parseInt(args.offset ?? "0"), 0);
  const includePrivate = args.includePrivate !== false;

  const conditions: any[] = [eq(promptsTable.authorUsername, user.username), isNull(promptsTable.deletedAt)];
  if (!includePrivate) conditions.push(eq(promptsTable.isPublic, true));

  const prompts = await db
    .select({
      id: promptsTable.id, title: promptsTable.title, description: promptsTable.description,
      isPublic: promptsTable.isPublic, tags: promptsTable.tags,
      saveCount: promptsTable.saveCount, viewCount: promptsTable.viewCount,
      priceCents: promptsTable.priceCents,
      avgRating: promptsTable.avgRating, ratingCount: promptsTable.ratingCount,
      categoryName: categoriesTable.name, categorySlug: categoriesTable.slug,
      createdAt: promptsTable.createdAt, updatedAt: promptsTable.updatedAt,
    })
    .from(promptsTable)
    .leftJoin(categoriesTable, eq(promptsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(desc(promptsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Purchase counts per prompt
  const ids = prompts.map((p) => p.id);
  let purchaseCounts: Record<number, { count: number; revenue: number }> = {};
  if (ids.length > 0) {
    const rows = await db.execute(sql`
      SELECT item_id, count(*)::int AS purchase_count, coalesce(sum(price_cents), 0)::int AS revenue_cents
      FROM purchases WHERE item_type = 'prompt'
        AND item_id = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[])
      GROUP BY item_id
    `);
    for (const r of rows.rows as any[]) {
      purchaseCounts[r.item_id] = { count: r.purchase_count, revenue: r.revenue_cents };
    }
  }

  return {
    prompts: prompts.map((p) => ({
      id: p.id, title: p.title, description: p.description ?? "",
      isPublic: p.isPublic, tags: p.tags,
      category: p.categoryName ?? null, categorySlug: p.categorySlug ?? null,
      saves: p.saveCount, views: p.viewCount,
      priceCents: p.priceCents ?? null,
      purchaseCount: purchaseCounts[p.id]?.count ?? 0,
      revenueCents: purchaseCounts[p.id]?.revenue ?? 0,
      avgRating: Number(p.avgRating), ratingCount: p.ratingCount,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    })),
    offset, limit,
    note: prompts.length === limit ? `More results — increment offset by ${limit} for next page.` : undefined,
  };
}

async function createPrompt(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const title = String(args.title ?? "").trim();
  const content = String(args.content ?? "").trim();
  if (!title) throw new Error("title is required");
  if (!content) throw new Error("content is required");
  if (title.length > 200) throw new Error("title must be 200 chars or fewer");

  const categoryId = args.categoryId ? parseInt(args.categoryId, 10) : 1;
  const tags: string[] = Array.isArray(args.tags) ? args.tags.slice(0, 10).map(String) : [];
  const isPublic: boolean = args.isPublic !== undefined ? Boolean(args.isPublic) : true;
  const priceCents: number | null = args.priceCents !== undefined ? Math.max(0, parseInt(args.priceCents, 10)) : null;
  const idempotencyKey: string | null = args.idempotencyKey ? String(args.idempotencyKey).trim() : null;

  // Idempotency: return existing prompt if this key was already used
  if (idempotencyKey) {
    const [existing] = await db.select().from(promptsTable)
      .where(and(eq(promptsTable.authorUsername, user.username), eq(promptsTable.idempotencyKey, idempotencyKey)));
    if (existing) return {
      success: true, idempotent: true,
      prompt: { id: existing.id, title: existing.title, description: existing.description, categoryId: existing.categoryId, tags: existing.tags, priceCents: existing.priceCents, isPublic: existing.isPublic, author: existing.authorUsername, createdAt: existing.createdAt },
    };
  }

  const [prompt] = await db.insert(promptsTable).values({
    title, content,
    description: args.description ? String(args.description) : null,
    categoryId, tags, priceCents, idempotencyKey,
    authorUsername: user.username,
    isPublic,
  }).returning();

  return {
    success: true,
    prompt: {
      id: prompt.id, title: prompt.title, description: prompt.description,
      categoryId: prompt.categoryId, tags: prompt.tags, priceCents: prompt.priceCents,
      isPublic: prompt.isPublic, author: prompt.authorUsername, createdAt: prompt.createdAt,
    },
  };
}

async function createPromptsBulk(args: Record<string, any>, apiKey: ApiKey) {
  const items = Array.isArray(args.prompts) ? args.prompts : [];
  if (items.length === 0) throw new Error("prompts array must not be empty");
  if (items.length > 50) throw new Error("Maximum 50 prompts per bulk call");

  const results = await Promise.allSettled(items.map((item) => createPrompt(item, apiKey)));
  const summary = results.map((r, i) =>
    r.status === "fulfilled"
      ? { index: i, success: true, promptId: (r.value as any).prompt?.id }
      : { index: i, success: false, error: (r.reason as Error).message }
  );

  const successCount = summary.filter((s) => s.success).length;
  return { created: successCount, failed: summary.length - successCount, results: summary };
}

async function updatePrompt(args: Record<string, any>, apiKey: ApiKey) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [existing] = await db.select().from(promptsTable).where(eq(promptsTable.id, id));
  if (!existing) throw new Error(`Prompt ${id} not found`);

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existing.authorUsername));
  if (!author || !isOwner(author, apiKey.ownerClerkUserId)) throw new Error("Forbidden — you do not own this prompt");

  const updates: Partial<typeof promptsTable.$inferInsert> = { updatedAt: new Date() };
  if (args.title !== undefined) { const t = String(args.title).trim(); if (t.length > 200) throw new Error("title must be 200 chars or fewer"); updates.title = t; }
  if (args.content !== undefined) updates.content = String(args.content);
  if (args.description !== undefined) updates.description = String(args.description);
  if (args.categoryId !== undefined) updates.categoryId = parseInt(args.categoryId, 10);
  if (args.tags !== undefined) updates.tags = Array.isArray(args.tags) ? args.tags.slice(0, 10).map(String) : [];
  if (args.isPublic !== undefined) updates.isPublic = Boolean(args.isPublic);
  if (args.priceCents !== undefined) updates.priceCents = args.priceCents === null ? null : Math.max(0, parseInt(args.priceCents, 10));

  const [prompt] = await db.update(promptsTable).set(updates).where(eq(promptsTable.id, id)).returning();
  return { success: true, prompt: { id: prompt.id, title: prompt.title, description: prompt.description, categoryId: prompt.categoryId, tags: prompt.tags, isPublic: prompt.isPublic, updatedAt: prompt.updatedAt } };
}

async function deletePrompt(args: Record<string, any>, apiKey: ApiKey) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const [existing] = await db.select().from(promptsTable).where(eq(promptsTable.id, id));
  if (!existing) throw new Error(`Prompt ${id} not found`);

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, existing.authorUsername));
  if (!author || !isOwner(author, apiKey.ownerClerkUserId)) throw new Error("Forbidden — you do not own this prompt");

  await db.update(promptsTable).set({ deletedAt: new Date() }).where(eq(promptsTable.id, id));
  return { success: true, deleted: { id, title: existing.title } };
}

async function forkPrompt(args: Record<string, any>, apiKey: ApiKey) {
  const id = parseInt(args.id, 10);
  if (isNaN(id)) throw new Error("id must be a number");

  const user = await requireUser(apiKey.ownerClerkUserId);

  const [source] = await db.select().from(promptsTable).where(and(eq(promptsTable.id, id), isNull(promptsTable.deletedAt)));
  if (!source) throw new Error(`Prompt ${id} not found`);

  // Must own, have purchased, or have unlocked via a library purchase
  const [sourceAuthor] = await db.select().from(usersTable).where(eq(usersTable.username, source.authorUsername));
  const owns = sourceAuthor && isOwner(sourceAuthor, apiKey.ownerClerkUserId);
  if (!owns) {
    const hasAccess = await checkPromptAccess(apiKey.ownerClerkUserId, id);
    if (!hasAccess) throw new Error("You must own or have purchased this prompt to fork it.");
  }

  const [forked] = await db.insert(promptsTable).values({
    title: `Fork of: ${source.title}`,
    content: source.content,
    description: source.description,
    categoryId: source.categoryId,
    tags: source.tags,
    authorUsername: user.username,
    isPublic: false, // starts as a private draft
  }).returning();

  return {
    success: true,
    note: "Forked as a private draft. Use update_prompt to edit and set isPublic: true when ready.",
    fork: { id: forked.id, title: forked.title, isPublic: forked.isPublic, createdAt: forked.createdAt },
    forkedFrom: { id: source.id, title: source.title, author: source.authorUsername },
  };
}

// ── Economics handlers ────────────────────────────────────────────────────

async function getBalance(apiKey: ApiKey) {
  return {
    creditsCents: apiKey.creditsCents,
    creditsDollars: (apiKey.creditsCents / 100).toFixed(2),
    note: "Top up in Settings → API Keys.",
  };
}

async function purchasePrompt(args: Record<string, any>, apiKey: ApiKey) {
  const promptId = parseInt(args.id, 10);
  if (isNaN(promptId)) throw new Error("id must be a number");

  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, promptId));
  if (!prompt) throw new Error(`Prompt ${promptId} not found`);

  const [existing] = await db.select().from(purchasesTable).where(
    and(eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId), eq(purchasesTable.itemType, "prompt"), eq(purchasesTable.itemId, promptId)),
  );
  if (existing) return { alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } };

  const [author] = await db.select().from(usersTable).where(eq(usersTable.username, prompt.authorUsername));
  if (author && isOwner(author, apiKey.ownerClerkUserId)) {
    return { alreadyOwned: true, prompt: { id: prompt.id, title: prompt.title, content: prompt.content } };
  }

  const priceCents = prompt.priceCents ?? author?.promptPriceCents ?? 500;
  const amounts = calculateTransactionAmounts(priceCents);
  if (priceCents > 0 && apiKey.creditsCents < priceCents) {
    throw new Error(`Insufficient credits. Need $${(priceCents / 100).toFixed(2)}, have $${(apiKey.creditsCents / 100).toFixed(2)}. Top up in Settings → API Keys.`);
  }

  if (priceCents > 0) {
    await db.update(apiKeysTable).set({ creditsCents: apiKey.creditsCents - priceCents }).where(eq(apiKeysTable.id, apiKey.id));
  }
  await db.insert(purchasesTable).values({
    clerkUserId: apiKey.ownerClerkUserId,
    itemType: "prompt",
    transactionType: "prompt_purchase",
    itemId: promptId,
    priceCents,
    commissionCents: amounts.commissionCents,
    netCents: amounts.netCents,
  });

  return {
    success: true,
    charged: priceCents,
    commissionCents: amounts.commissionCents,
    creatorNetCents: amounts.netCents,
    remainingCreditsCents: apiKey.creditsCents - priceCents,
    prompt: { id: prompt.id, title: prompt.title, content: prompt.content },
  };
}

async function listPurchased(args: Record<string, any>, apiKey: ApiKey) {
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 100);

  const rows = await db.select({ itemId: purchasesTable.itemId, priceCents: purchasesTable.priceCents, purchasedAt: purchasesTable.createdAt })
    .from(purchasesTable)
    .where(and(eq(purchasesTable.clerkUserId, apiKey.ownerClerkUserId), eq(purchasesTable.itemType, "prompt")))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.itemId);
  const prompts = await db.select({ id: promptsTable.id, title: promptsTable.title })
    .from(promptsTable)
    .where(sql`${promptsTable.id} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[])`);
  const byId = Object.fromEntries(prompts.map((p) => [p.id, p.title]));

  return rows.map((r) => ({ id: r.itemId, title: byId[r.itemId] ?? "Unknown", priceCents: r.priceCents, purchasedAt: r.purchasedAt }));
}

async function getEarnings(apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);

  const rows = await db.execute(sql`
    SELECT
      p.item_id AS prompt_id,
      pr.title,
      count(p.id)::int AS sale_count,
      coalesce(sum(p.price_cents), 0)::int AS gross_cents,
      coalesce(sum(p.commission_cents), 0)::int AS commission_cents,
      coalesce(sum(p.net_cents), 0)::int AS net_cents
    FROM purchases p
    JOIN prompts pr ON pr.id = p.item_id
    WHERE p.item_type = 'prompt'
      AND pr.author_username = ${user.username}
    GROUP BY p.item_id, pr.title
    ORDER BY net_cents DESC
  `);

  const perPrompt = (rows.rows as any[]).map((r) => ({
    promptId: r.prompt_id,
    title: r.title,
    saleCount: r.sale_count,
    grossCents: r.gross_cents,
    commissionCents: r.commission_cents,
    netCents: r.net_cents,
    netDollars: (r.net_cents / 100).toFixed(2),
  }));

  const grossCents = perPrompt.reduce((s, r) => s + r.grossCents, 0);
  const commissionCents = perPrompt.reduce((s, r) => s + r.commissionCents, 0);
  const netCents = perPrompt.reduce((s, r) => s + r.netCents, 0);

  return {
    grossRevenueCents: grossCents,
    platformCommissionCents: commissionCents,
    netEarningsCents: netCents,
    netEarningsDollars: (netCents / 100).toFixed(2),
    promptCount: perPrompt.length,
    perPrompt,
    note: "Payout processing is handled via Whop. Check your Whop dashboard for payout status.",
  };
}

async function listTransactions(args: Record<string, any>, apiKey: ApiKey) {
  const user = await requireUser(apiKey.ownerClerkUserId);
  const limit = Math.min(Math.max(parseInt(args.limit ?? "50"), 1), 100);
  const type = args.type ?? "all";

  const rows = await db.execute(sql`
    SELECT
      p.id,
      p.item_id AS prompt_id,
      pr.title,
      p.price_cents,
      p.commission_cents,
      p.net_cents,
      p.created_at,
      CASE WHEN pr.author_username = ${user.username} THEN 'earning' ELSE 'spending' END AS direction
    FROM purchases p
    JOIN prompts pr ON pr.id = p.item_id
    WHERE p.item_type = 'prompt'
      AND (
        p.clerk_user_id = ${apiKey.ownerClerkUserId}   -- spent by me
        OR pr.author_username = ${user.username}         -- earned by me
      )
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `);

  let txns = (rows.rows as any[]).map((r) => ({
    id: r.id,
    promptId: r.prompt_id,
    title: r.title,
    priceCents: r.price_cents,
    commissionCents: r.commission_cents,
    netCents: r.net_cents,
    direction: r.direction as "earning" | "spending",
    date: r.created_at,
  }));

  if (type === "spending") txns = txns.filter((t) => t.direction === "spending");
  else if (type === "earnings") txns = txns.filter((t) => t.direction === "earning");

  return txns;
}

// ── JSON-RPC dispatcher ───────────────────────────────────────────────────

function jsonrpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function jsonrpcOk(id: any, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

router.get("/mcp", sendMcpDiscovery);

router.post("/mcp", async (req, res): Promise<void> => {
  const apiKey = (req as any).apiKey as ApiKey | undefined;
  const body = req.body as { jsonrpc?: string; method?: string; params?: any; id?: any };
  const { id = null, method, params = {} } = body;

  if (!method) {
    res.json(jsonrpcError(id, -32600, "Invalid request — missing method"));
    return;
  }

  try {
    if (method === "initialize") {
      res.json(jsonrpcOk(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "Promptly", version: "2.0.0" },
        instructions: `Promptly is an AI prompt marketplace with ${TOOLS.length} tools. Start with whoami() to confirm your account, list_categories() to orient yourself, then search_prompts() to browse. Use validate_prompt() and extract_variables() before publishing. All writes require a Bearer API key — get one at https://prompt-marketplace99.replit.app/settings.`,
      }));
      return;
    }

    if (method === "tools/list") {
      res.json(jsonrpcOk(id, { tools: TOOLS }));
      return;
    }

    if (method === "tools/call") {
      const { name, arguments: args = {} } = params as { name?: string; arguments?: Record<string, any> };
      if (!name) { res.json(jsonrpcError(id, -32602, "Missing tool name")); return; }

      if (AUTH_REQUIRED.has(name) && !apiKey) {
        // isError:true shows the real message in Claude — protocol errors (-32xxx) collapse to "Error occurred during tool execution"
        res.json(jsonrpcOk(id, {
          content: [{ type: "text", text: `"${name}" requires authentication.\n\nProvide your API key:\n  • Header:    Authorization: Bearer sk_...\n  • URL param:  ?key=sk_...\n\nGet a key at https://prompt-marketplace99.replit.app/settings` }],
          isError: true,
        }));
        return;
      }

      let result: unknown;
      switch (name) {
        // Session
        case "whoami": result = await whoami(apiKey!); break;
        // Browse
        case "list_categories": result = await listCategories(); break;
        case "create_category": result = await createCategory(args, apiKey!); break;
        case "list_tags": result = await listTags(args); break;
        case "list_authors": result = await listAuthors(args); break;
        case "get_author": result = await getAuthor(args); break;
        case "search_prompts": result = await searchPrompts(args); break;
        case "get_prompt": result = await getPrompt(args, apiKey); break;
        case "get_similar": result = await getSimilar(args); break;
        case "get_prompt_stats": result = await getPromptStats(args); break;
        case "list_reviews": result = await listReviews(args); break;
        // Save/collect
        case "save_prompt": result = await savePrompt(args, apiKey!); break;
        case "unsave_prompt": result = await unsavePrompt(args, apiKey!); break;
        case "list_saved": result = await listSaved(args, apiKey!); break;
        case "create_collection": result = await createCollection(args, apiKey!); break;
        case "add_to_collection": result = await addToCollection(args, apiKey!); break;
        case "list_collections": result = await listCollections(args, apiKey!); break;
        // Evaluate
        case "create_review": result = await createReview(args, apiKey!); break;
        // Utilities
        case "validate_prompt": result = validatePrompt(args); break;
        case "extract_variables": result = extractVariables(args); break;
        // Authoring
        case "list_my_prompts": result = await listMyPrompts(args, apiKey!); break;
        case "create_prompt": result = await createPrompt(args, apiKey!); break;
        case "create_prompts_bulk": result = await createPromptsBulk(args, apiKey!); break;
        case "update_prompt": result = await updatePrompt(args, apiKey!); break;
        case "delete_prompt": result = await deletePrompt(args, apiKey!); break;
        case "fork_prompt": result = await forkPrompt(args, apiKey!); break;
        // Economics
        case "get_balance": result = await getBalance(apiKey!); break;
        case "purchase_prompt": result = await purchasePrompt(args, apiKey!); break;
        case "list_purchased": result = await listPurchased(args, apiKey!); break;
        case "get_earnings": result = await getEarnings(apiKey!); break;
        case "list_transactions": result = await listTransactions(args, apiKey!); break;
        default:
          res.json(jsonrpcOk(id, {
            content: [{ type: "text", text: `Unknown tool: "${name}". Call tools/list to see all ${TOOLS.length} available tools.` }],
            isError: true,
          }));
          return;
      }

      res.json(jsonrpcOk(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }));
      return;
    }

    res.json(jsonrpcError(id, -32601, `Unknown method: ${method}`));
  } catch (err: any) {
    // isError:true shows the actual message in Claude.
    // Protocol-level errors (-32xxx) collapse to "Error occurred during tool execution" with no detail.
    res.json(jsonrpcOk(id, {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Internal error"}` }],
      isError: true,
    }));
  }
});

export default router;
