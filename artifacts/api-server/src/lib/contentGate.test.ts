import { CONTENT_PREVIEW_CHARS, truncateContent, applyContentGate } from "./contentGate";
import assert from "node:assert/strict";

const long = "A".repeat(CONTENT_PREVIEW_CHARS + 40);
const gated = truncateContent(long);
assert.equal(gated.length, CONTENT_PREVIEW_CHARS + 1); // 120 chars + ellipsis
assert.ok(gated.endsWith("…"));
assert.equal(truncateContent("short body"), "short body");
assert.equal(truncateContent("  lots   of\nspace  ").includes("  "), false);

const full = applyContentGate({ id: 1, content: long }, true);
assert.equal(full.isGated, false);
assert.equal(full.content, long);

const preview = applyContentGate({ id: 1, content: long }, false);
assert.equal(preview.isGated, true);
assert.notEqual(preview.content, long);
assert.ok(preview.content.endsWith("…"));

console.log("contentGate tests passed");
