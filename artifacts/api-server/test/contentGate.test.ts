import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  CONTENT_PREVIEW_CHARS,
  GATED_CONTENT_MAX_LENGTH,
  truncateContent,
  applyContentGate,
  gatePromptCollection,
  gatedPromptListResponse,
  gatedTrendingResponse,
  mayCopyPromptContent,
  libraryMembershipUnlocksPrompt,
  canAddPromptToLibrary,
  assertAnonymousCatalogGated,
  assertAnonymousPromptListGated,
} from "../src/lib/contentGate.ts";
import {
  mcpDiscoveryPayload,
  MCP_SURFACES,
  advertisedMcpTools,
  sendMcpDiscovery,
} from "../src/lib/mcpDiscovery.ts";

const FULL = "SECRET_PROMPT_BODY_" + "X".repeat(400);
const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..");
const repoRoot = join(apiRoot, "..", "..");

function sample(id: number) {
  return { id, title: `Prompt ${id}`, content: FULL };
}

function readSrc(...parts: string[]) {
  return readFileSync(join(...parts), "utf8");
}

test("truncateContent collapses whitespace and caps length", () => {
  const long = "A".repeat(CONTENT_PREVIEW_CHARS + 40);
  const gated = truncateContent(long);
  assert.equal(gated.length, GATED_CONTENT_MAX_LENGTH);
  assert.ok(gated.endsWith("…"));
  assert.equal(truncateContent("short body"), "short body");
  assert.equal(truncateContent("  lots   of\nspace  "), "lots of space");
});

test("applyContentGate keeps full body only when hasAccess", () => {
  const full = applyContentGate({ id: 1, content: FULL }, true);
  assert.equal(full.isGated, false);
  assert.equal(full.content, FULL);

  const preview = applyContentGate({ id: 1, content: FULL }, false);
  assert.equal(preview.isGated, true);
  assert.notEqual(preview.content, FULL);
  assert.ok(preview.content.length <= GATED_CONTENT_MAX_LENGTH);
});

test("unauthenticated list does not include full content", () => {
  const body = {
    prompts: gatePromptCollection([sample(1), sample(2)], new Set()),
    total: 2,
  };
  assertAnonymousPromptListGated(body);
  for (const p of body.prompts) {
    assert.equal(p.isGated, true);
    assert.ok(p.content.length <= GATED_CONTENT_MAX_LENGTH);
    assert.notEqual(p.content, FULL);
  }
});

test("unauthenticated trending does not include full content", () => {
  const trending = gatePromptCollection([sample(10), sample(11)], new Set());
  assertAnonymousCatalogGated(trending);
  for (const p of trending) {
    assert.equal(p.isGated, true);
    assert.ok(p.content.length <= GATED_CONTENT_MAX_LENGTH);
    assert.notEqual(p.content, FULL);
  }
});

test("library nested prompts are gated the same way as the catalog list", () => {
  const nested = gatePromptCollection([sample(188), sample(189)], new Set());
  const library = { id: 4, prompts: nested };
  assertAnonymousCatalogGated(library.prompts);
  for (const p of library.prompts) {
    assert.equal(p.isGated, true);
    assert.ok(p.content.length <= GATED_CONTENT_MAX_LENGTH);
    assert.notEqual(p.content, FULL);
  }

  // Owning/buying a collection must not unlock other people's text:
  // only prompt ids in accessibleIds are ungated (author / prompt purchase).
  const ownerView = gatePromptCollection([sample(188), sample(189)], new Set([188]));
  assert.equal(ownerView[0].isGated, false);
  assert.equal(ownerView[0].content, FULL);
  assert.equal(ownerView[1].isGated, true);
  assert.ok(ownerView[1].content.length <= GATED_CONTENT_MAX_LENGTH);
});

test("library membership does not unlock other authors' prompts", () => {
  assert.equal(libraryMembershipUnlocksPrompt("alice", "alice"), true);
  assert.equal(libraryMembershipUnlocksPrompt("bob", "alice"), false);
  assert.equal(libraryMembershipUnlocksPrompt("alice", "bob"), false);

  // Sellable collections cannot take third-party members; bookmark lists can
  // point at them, but buyers still do not get those bodies (same-author unlock).
  assert.equal(canAddPromptToLibrary("collection", "bob", "alice"), false);
  assert.equal(canAddPromptToLibrary("collection", "alice", "alice"), true);
  assert.equal(canAddPromptToLibrary("saved", "bob", "alice"), true);

  const stuffed = [
    { id: 188, title: "alice own", content: FULL, authorUsername: "alice" },
    { id: 189, title: "bob stolen", content: FULL, authorUsername: "bob" },
  ];
  const purchaserIds = new Set(
    stuffed
      .filter((p) => libraryMembershipUnlocksPrompt(p.authorUsername, "alice"))
      .map((p) => p.id),
  );
  const forBuyer = gatePromptCollection(stuffed, purchaserIds);
  assert.equal(forBuyer[0].isGated, false);
  assert.equal(forBuyer[0].content, FULL);
  assert.equal(forBuyer[1].isGated, true);
  assert.notEqual(forBuyer[1].content, FULL);
});

test("detail copy honors isGated — no copy unless ungated", () => {
  assert.equal(mayCopyPromptContent(true), false);
  assert.equal(mayCopyPromptContent(undefined), false);
  assert.equal(mayCopyPromptContent(false), true);

  const gated = applyContentGate(sample(7), false);
  assert.equal(mayCopyPromptContent(gated.isGated), false);
  const owned = applyContentGate(sample(7), true);
  assert.equal(mayCopyPromptContent(owned.isGated), true);
  assert.equal(owned.content, FULL);
});

test("list, trending, and nested library routes apply the catalog gate helpers", () => {
  const prompts = readSrc(apiRoot, "src/routes/prompts.ts");
  const libraries = readSrc(apiRoot, "src/routes/libraries.ts");
  const promptAccess = readSrc(apiRoot, "src/lib/promptAccess.ts");

  assert.match(prompts, /router\.get\("\/prompts\/trending"/);
  assert.match(prompts, /gatedTrendingResponse\(built, accessible\)/);
  assert.match(prompts, /router\.get\("\/prompts"/);
  assert.match(prompts, /gatedPromptListResponse\(built, accessible,/);
  assert.doesNotMatch(
    prompts,
    /res\.json\(ListPromptsResponse\.parse\(\{ prompts: built/,
    "GET /prompts must not return ungated built rows",
  );

  assert.match(libraries, /router\.get\("\/libraries\/:id"/);
  assert.match(libraries, /gatePromptCollection\(built, accessible\)/);
  assert.match(libraries, /router\.post\("\/libraries\/:id\/prompts"/);
  assert.match(libraries, /canAddPromptToLibrary/);
  assert.match(promptAccess, /libraryMembershipUnlocksPrompt/);
});

test("prompt and library writes require a signed-in publisher or owner", () => {
  const prompts = readSrc(apiRoot, "src/routes/prompts.ts");
  const libraries = readSrc(apiRoot, "src/routes/libraries.ts");

  const postPrompt = prompts.slice(prompts.indexOf('router.post("/prompts"'));
  assert.match(postPrompt, /requirePublisher/);
  assert.match(postPrompt, /authorUsername: publisher\.authorUsername/);

  const postLibrary = libraries.slice(libraries.indexOf('router.post("/libraries"'));
  assert.match(postLibrary, /requirePublisher/);
  assert.match(postLibrary, /authorUsername: publisher\.authorUsername/);

  const postSave = prompts.slice(prompts.indexOf('router.post("/prompts/:id/save"'));
  assert.match(postSave, /requirePublisher\(getCallerClerkUserId\(req\)\)/);
  assert.match(postSave, /publisher\.authorUsername/);
  assert.doesNotMatch(postSave, /parsed\.data\.username/);
  assert.ok(
    postSave.indexOf("requirePublisher") < postSave.indexOf("ToggleSavePromptBody"),
    "POST /prompts/:id/save must 401 before trusting the body",
  );

  const patchLibrary = libraries.slice(libraries.indexOf('router.patch("/libraries/:id"'));
  assert.match(patchLibrary, /loadOwnedLibrary/);
  assert.match(patchLibrary, /priceCents/);
  assert.ok(
    patchLibrary.indexOf("loadOwnedLibrary") < patchLibrary.indexOf("priceCents"),
    "PATCH must authorize before writing priceCents",
  );
});

test("prompt-detail, explore, and library-detail copy fail closed on isGated", () => {
  const detail = readSrc(repoRoot, "artifacts/prompt-marketplace/src/pages/prompt-detail.tsx");
  const explore = readSrc(repoRoot, "artifacts/prompt-marketplace/src/pages/explore.tsx");
  const library = readSrc(repoRoot, "artifacts/prompt-marketplace/src/pages/library-detail.tsx");

  assert.match(detail, /prompt\.isGated !== false/);
  assert.match(detail, /prompt\.isGated === false/);
  assert.match(explore, /prompt\.isGated !== false/);
  assert.match(explore, /prompt\.isGated === false/);
  assert.match(library, /item\.isGated !== false/);
  assert.match(library, /prompt\.isGated === false/);
});

test("GET /api/mcp and /.well-known/mcp.json discover live tools, publish invite-only", async () => {
  const app = express();
  app.get("/api/mcp", sendMcpDiscovery);
  app.get("/.well-known/mcp.json", sendMcpDiscovery);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected TCP address");
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    for (const path of ["/api/mcp", "/.well-known/mcp.json"]) {
      const res = await fetch(`${base}${path}`);
      assert.notEqual(res.status, 404, `${path} must not 404`);
      assert.equal(res.status, 200);
      const body = await res.json() as {
        endpoint: string;
        tools: string[];
        surfaces: { publish: { access?: string; description?: string; tools: string[] }; buy: { tools: string[] } };
      };
      assert.equal(body.endpoint, `${base}/api/mcp`);
      assert.ok(body.tools.includes("create_prompt"));
      assert.ok(body.tools.includes("purchase_prompt"));
      assert.deepEqual(body.tools, advertisedMcpTools());
      assert.equal(body.surfaces.publish.access, "invite-only");
      assert.match(body.surfaces.publish.description ?? "", /invite-only|not a public free-for-all/i);
      assert.ok(body.surfaces.publish.tools.includes("create_prompt"));
      assert.ok(body.surfaces.buy.tools.includes("purchase_prompt"));
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test("GET /api/mcp discovery lists publish as invite-only", () => {
  const doc = mcpDiscoveryPayload("https://example.test/api/mcp");
  assert.ok(doc.tools.includes("create_prompt"));
  assert.ok(doc.tools.includes("purchase_prompt"));
  assert.equal(doc.tools.length, advertisedMcpTools().length);
  assert.equal(doc.surfaces.publish.access, "invite-only");
  assert.ok(MCP_SURFACES.publish.includes("create_prompt"));
  assert.match(doc.usage, /GET returns this discovery document/);
});

test("llms.txt and discovery routes advertise invite-only publish and gated catalog", () => {
  const llms = readSrc(repoRoot, "artifacts/prompt-marketplace/public/llms.txt");
  const discovery = readSrc(apiRoot, "src/routes/discovery.ts");
  const mcp = readSrc(apiRoot, "src/routes/mcp.ts");

  assert.match(llms, /invite-only/);
  assert.match(llms, /not a public free-for-all/);
  assert.match(llms, /GET \/api\/mcp/);
  assert.match(llms, /preview unless purchased/);
  assert.match(discovery, /sendMcpDiscovery/);
  assert.match(discovery, /invite-only — not a public free-for-all/);
  assert.match(mcp, /router\.get\("\/mcp", sendMcpDiscovery\)/);
  assert.match(mcp, /Invite-only — not a public free-for-all/);
});

test("anonymous GET /api/prompts and /api/prompts/trending return previews only", () => {
  const promptsSrc = readSrc(apiRoot, "src/routes/prompts.ts");
  assert.match(
    promptsSrc,
    /res\.json\(ListPromptsResponse\.parse\(gatedPromptListResponse\(built, accessible,/,
    "GET /api/prompts must send gatedPromptListResponse — removing this fails pnpm test",
  );
  assert.match(
    promptsSrc,
    /res\.json\(GetTrendingPromptsResponse\.parse\(gatedTrendingResponse\(built, accessible\)\)\)/,
    "GET /api/prompts/trending must send gatedTrendingResponse — removing this fails pnpm test",
  );

  const listBody = gatedPromptListResponse([sample(188), sample(189)], new Set(), 2);
  assertAnonymousPromptListGated(listBody);
  for (const p of listBody.prompts) {
    assert.equal(p.isGated, true);
    assert.ok(p.content.length <= GATED_CONTENT_MAX_LENGTH);
    assert.notEqual(p.content, FULL);
  }

  const trending = gatedTrendingResponse([sample(35)], new Set());
  assertAnonymousCatalogGated(trending);
  assert.equal(trending[0].isGated, true);
  assert.notEqual(trending[0].content, FULL);
});
