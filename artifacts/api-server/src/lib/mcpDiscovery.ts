import type { Request, Response } from "express";

/** Buy vs publish vs browse groupings advertised in discovery docs. */
export const MCP_SURFACES = {
  browse: [
    "list_categories", "list_tags", "list_authors", "get_author",
    "search_prompts", "get_prompt", "get_similar", "get_prompt_stats", "list_reviews",
  ],
  utilities: ["validate_prompt", "extract_variables"],
  collect: [
    "save_prompt", "unsave_prompt", "list_saved",
    "create_collection", "add_to_collection", "list_collections",
  ],
  evaluate: ["create_review"],
  publish: [
    "whoami", "create_category", "list_my_prompts", "create_prompt", "create_prompts_bulk",
    "update_prompt", "delete_prompt", "fork_prompt",
  ],
  buy: ["get_balance", "purchase_prompt", "list_purchased", "get_earnings", "list_transactions"],
} as const;

export const AUTH_REQUIRED = new Set([
  "whoami",
  "create_category",
  "save_prompt", "unsave_prompt", "list_saved",
  "create_collection", "add_to_collection", "list_collections",
  "create_review",
  "list_my_prompts", "create_prompt", "create_prompts_bulk", "update_prompt", "delete_prompt", "fork_prompt",
  "get_balance", "purchase_prompt", "list_purchased", "get_earnings", "list_transactions",
]);

export function advertisedMcpTools(): string[] {
  return Object.values(MCP_SURFACES).flatMap((names) => [...names]);
}

export function mcpDiscoveryPayload(endpoint: string) {
  return {
    mcpVersion: "2024-11-05",
    name: "Promptly",
    description: "AI prompt marketplace — browse, buy, and publish prompts programmatically.",
    endpoint,
    protocol: "JSON-RPC 2.0",
    transport: "http",
    usage: "POST a JSON-RPC 2.0 body to this URL. GET returns this discovery document.",
    authentication: {
      type: "bearer",
      description: "Generate an API key at /settings. Include it as Authorization: Bearer sk_... or ?key=sk_...",
    },
    surfaces: {
      browse: {
        auth: "none",
        description: "Catalog search and metadata. Prompt bodies are previews only — call purchase_prompt (buy) to unlock full text.",
        tools: [...MCP_SURFACES.browse],
      },
      buy: {
        auth: "bearer",
        description: "Spend credits to purchase prompts and retrieve full text.",
        tools: [...MCP_SURFACES.buy],
      },
      publish: {
        auth: "bearer",
        access: "invite-only",
        description:
          "Create and manage prompts you own. Publish exists on this MCP but is invite-only — not a public free-for-all. An API key does not grant open publishing.",
        tools: [...MCP_SURFACES.publish],
      },
      collect: { auth: "bearer", tools: [...MCP_SURFACES.collect] },
      evaluate: { auth: "bearer", tools: [...MCP_SURFACES.evaluate] },
      utilities: { auth: "none", tools: [...MCP_SURFACES.utilities] },
    },
    tools: advertisedMcpTools(),
  };
}

/** GET /api/mcp and GET /.well-known/mcp.json — discovery only, no auth. */
export function sendMcpDiscovery(req: Request, res: Response): void {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.headers.host || "";
  res.json(mcpDiscoveryPayload(`${proto}://${host}/api/mcp`));
}
