/**
 * Agent & LLM discovery routes — mounted at the root of the API server
 * (before the /api prefix) so they're reachable at standard well-known paths.
 *
 *   GET /.well-known/ai-plugin.json   OpenAI-compatible plugin manifest
 *   GET /.well-known/mcp.json         MCP server discovery
 *   GET /llms.txt                     Human + LLM-readable site description
 *   GET /openapi.json                 Minimal OpenAPI spec for the agent API
 */

import { Router, type Request, type Response } from "express";
import { mcpDiscoveryPayload, MCP_SURFACES, TOOLS, AUTH_REQUIRED } from "./mcp";

const router: Router = Router();

function baseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.headers.host || "";
  return `${proto}://${host}`;
}

// ── /.well-known/ai-plugin.json ───────────────────────────────────────────

router.get("/.well-known/ai-plugin.json", (req: Request, res: Response) => {
  const base = baseUrl(req);
  res.json({
    schema_version: "v1",
    name_for_human: "Promptly",
    name_for_model: "promptly",
    description_for_human: "Browse and buy AI prompts from the Promptly marketplace.",
    description_for_model:
      "Promptly is an AI prompt marketplace. Use this plugin to search for high-quality prompts across categories like finance, law, writing, and marketing. Prompts can be purchased with credits using an API key. " +
      "Key actions: search_prompts (browse catalog), get_prompt (details + preview), purchase_prompt (unlock full text with credits), get_balance (check credits), list_purchased (owned prompts). " +
      "Authenticate with Authorization: Bearer sk_... (keys created at /settings on the site).",
    auth: {
      type: "user_http",
      authorization_type: "bearer",
    },
    api: {
      type: "openapi",
      url: `${base}/openapi.json`,
    },
    logo_url: `${base}/logo.svg`,
    contact_email: "hello@promptly.app",
    legal_info_url: `${base}/`,
  });
});

// ── /.well-known/mcp.json ─────────────────────────────────────────────────

router.get("/.well-known/mcp.json", (req: Request, res: Response) => {
  const base = baseUrl(req);
  res.json(mcpDiscoveryPayload(`${base}/api/mcp`));
});

// ── /llms.txt ─────────────────────────────────────────────────────────────

router.get("/llms.txt", (req: Request, res: Response) => {
  const base = baseUrl(req);
  const browse = MCP_SURFACES.browse.map((n) => `  ${n}`).join("\n");
  const buy = MCP_SURFACES.buy.map((n) => `  ${n}`).join("\n");
  const publish = MCP_SURFACES.publish.map((n) => `  ${n}`).join("\n");
  const collect = MCP_SURFACES.collect.map((n) => `  ${n}`).join("\n");
  const utilities = MCP_SURFACES.utilities.map((n) => `  ${n}`).join("\n");
  res.type("text/plain").send(`# Promptly — AI Prompt Marketplace
> A marketplace where AI creators publish ready-to-use prompts across finance, law, marketing, writing, design, and more. AI agents can browse, preview, buy, and publish prompts programmatically.

## What Promptly offers
- Curated prompts across 10+ categories
- Individual prompts (typically $5) and curated collections (typically $100)
- Programmatic access via REST API and MCP server
- Full prompt text is gated until purchase (or you are the author)

## MCP Server (recommended for agents)
Endpoint: ${base}/api/mcp
Protocol: JSON-RPC 2.0, HTTP stateless transport
Discovery: GET ${base}/api/mcp  or  GET ${base}/.well-known/mcp.json
Auth: Authorization: Bearer sk_...  (or ?key=sk_...)
Note: GET /api/mcp is discovery only. Tool calls use POST.

There are ${TOOLS.length} tools. Buy tools unlock others' prompts; publish tools create your own. They are not interchangeable.

### Browse (no auth) — metadata + preview only
${browse}

### Utilities (no auth)
${utilities}

### Buy (API key) — spend credits, retrieve full text
${buy}

### Publish (API key) — create and manage your prompts
${publish}

### Collect (API key)
${collect}

### Evaluate (API key)
  create_review

Tools that require a key: ${[...AUTH_REQUIRED].join(", ")}

## REST API (alternative)
Base: ${base}/api
Content-Type: application/json
Auth: Authorization: Bearer sk_...  (same key as MCP)

GET  /api/prompts                    List / search prompts (content is a preview unless purchased)
GET  /api/prompts/:id               Single prompt (preview unless purchased / author)
GET  /api/prompts/:id/content       Full text (requires purchase or ownership)
GET  /api/categories                List categories
POST /api/agent/purchase            { promptId } — buy with credits
GET  /api/agent/balance             Check credits
GET  /api/agent/purchased           Purchased prompt history
GET  /api/mcp                       MCP discovery document (POST for JSON-RPC)

## Getting an API key
1. Create an account at ${base}
2. Go to Settings → API Keys
3. Click "Generate key" — copy the key immediately (shown once)
4. Optionally top up credits from the same page

## Pricing
- Individual prompts: set by creator, default $5
- Credits are pre-loaded and deducted per purchase
- Free preview (first ~120 chars on REST, 300 chars on MCP get_prompt) without authentication

## Crawler guidance
- All public prompts are indexable
- Full content requires purchase — preview is freely accessible
- robots.txt: all crawlers welcome on public pages

## OpenAPI spec
${base}/openapi.json

## MCP discovery
${base}/.well-known/mcp.json
${base}/api/mcp
`);
});

// ── /openapi.json ─────────────────────────────────────────────────────────

router.get("/openapi.json", (req: Request, res: Response) => {
  const base = baseUrl(req);
  res.json({
    openapi: "3.1.0",
    info: {
      title: "Promptly Agent API",
      version: "1.0.0",
      description: "Programmatic access to the Promptly prompt marketplace for AI agents.",
    },
    servers: [{ url: `${base}/api`, description: "Production" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "sk_..." },
      },
    },
    paths: {
      "/prompts": {
        get: {
          operationId: "listPrompts",
          summary: "Search and list public prompts",
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          ],
          responses: { "200": { description: "Array of prompts" } },
          security: [],
        },
      },
      "/prompts/{id}": {
        get: {
          operationId: "getPrompt",
          summary: "Get prompt metadata and preview",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt object" } },
          security: [],
        },
      },
      "/prompts/{id}/content": {
        get: {
          operationId: "getPromptContent",
          summary: "Get full prompt text (requires purchase)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            "200": { description: "Full prompt content" },
            "402": { description: "Purchase required" },
            "403": { description: "Not purchased" },
          },
        },
      },
      "/agent/balance": {
        get: {
          operationId: "getBalance",
          summary: "Check API key credit balance",
          responses: { "200": { description: "Balance in cents and dollars" } },
        },
      },
      "/agent/purchase": {
        post: {
          operationId: "purchasePrompt",
          summary: "Purchase a prompt with credits",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { promptId: { type: "integer" } }, required: ["promptId"] } } },
          },
          responses: {
            "200": { description: "Purchase successful, full content returned" },
            "402": { description: "Insufficient credits" },
          },
        },
      },
      "/agent/purchased": {
        get: {
          operationId: "listPurchased",
          summary: "List prompts purchased by this key",
          responses: { "200": { description: "Array of purchases" } },
        },
      },
      "/agent/keys": {
        get: {
          operationId: "listKeys",
          summary: "List API keys (Clerk session auth)",
          security: [{ sessionAuth: [] }],
          responses: { "200": { description: "Array of API key objects (no raw keys)" } },
        },
        post: {
          operationId: "createKey",
          summary: "Create a new API key (Clerk session auth) — raw key returned once",
          security: [{ sessionAuth: [] }],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } } },
          responses: { "201": { description: "New key with raw value (copy immediately)" } },
        },
      },
      "/mcp": {
        get: {
          operationId: "mcpDiscover",
          summary: "MCP discovery document (JSON-RPC is POST)",
          responses: { "200": { description: "Endpoint, auth, and full tool/surface list" } },
          security: [],
        },
        post: {
          operationId: "mcpCall",
          summary: "MCP JSON-RPC 2.0 endpoint",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { jsonrpc: { type: "string" }, method: { type: "string" }, params: { type: "object" }, id: {} } } } },
          },
          responses: { "200": { description: "JSON-RPC 2.0 response" } },
        },
      },
    },
  });
});

export default router;
