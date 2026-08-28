import { createServer } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_PREVIEW_CHARS,
  GATED_CONTENT_MAX_LENGTH,
  truncateContent,
  applyContentGate,
  assertAnonymousPromptListGated,
} from "../src/lib/contentGate.ts";

test("truncateContent collapses whitespace and caps length", () => {
  const long = "A".repeat(CONTENT_PREVIEW_CHARS + 40);
  const gated = truncateContent(long);
  assert.equal(gated.length, GATED_CONTENT_MAX_LENGTH);
  assert.ok(gated.endsWith("…"));
  assert.equal(truncateContent("short body"), "short body");
  assert.equal(truncateContent("  lots   of\nspace  "), "lots of space");
});

test("applyContentGate keeps full body only when hasAccess", () => {
  const long = "A".repeat(CONTENT_PREVIEW_CHARS + 40);
  const full = applyContentGate({ id: 1, content: long }, true);
  assert.equal(full.isGated, false);
  assert.equal(full.content, long);

  const preview = applyContentGate({ id: 1, content: long }, false);
  assert.equal(preview.isGated, true);
  assert.notEqual(preview.content, long);
  assert.ok(preview.content.length <= GATED_CONTENT_MAX_LENGTH);
});

test("anonymous GET /api/prompts returns isGated: true and content.length ≤ 121", async () => {
  const long = "B".repeat(800);
  const catalogHandler = (_req: unknown, res: { writeHead: Function; end: Function }) => {
    const item = applyContentGate({
      id: 188,
      title: "test",
      content: long,
    }, false);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ prompts: [item], total: 1 }));
  };

  const liveBase = process.env.SMOKE_API_BASE?.replace(/\/$/, "");
  let url: string;
  let server: ReturnType<typeof createServer> | undefined;

  if (liveBase) {
    url = `${liveBase}/api/prompts?limit=5`;
  } else {
    server = createServer((req, res) => {
      if (req.method === "GET" && req.url?.startsWith("/api/prompts")) catalogHandler(req, res);
      else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("expected TCP address");
    url = `http://127.0.0.1:${addr.port}/api/prompts?limit=5`;
  }

  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const body = await res.json() as { prompts: Array<{ content: string; isGated: boolean }> };
    assert.ok(Array.isArray(body.prompts));
    assert.ok(body.prompts.length > 0);
    assertAnonymousPromptListGated(body);
    for (const p of body.prompts) {
      assert.equal(p.isGated, true);
      assert.ok(p.content.length <= 121);
    }
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((err) => err ? reject(err) : resolve()));
  }
});
