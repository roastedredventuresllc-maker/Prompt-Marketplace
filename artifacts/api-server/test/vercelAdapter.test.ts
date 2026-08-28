import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { publicAppUrl } from "../src/lib/publicAppUrl.ts";
import { normalizeVercelRequestUrl, VERCEL_EXPRESS_BRIDGE } from "../src/lib/vercelRequestUrl.ts";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..");
const repoRoot = join(apiRoot, "..", "..");

test("normalizeVercelRequestUrl unwraps the Express bridge prefix only", () => {
  assert.equal(normalizeVercelRequestUrl("/api/prompts?q=1"), "/api/prompts?q=1");
  assert.equal(
    normalizeVercelRequestUrl(`${VERCEL_EXPRESS_BRIDGE}/.well-known/mcp.json`),
    "/.well-known/mcp.json",
  );
  assert.equal(
    normalizeVercelRequestUrl(`${VERCEL_EXPRESS_BRIDGE}/oauth/authorize?foo=bar`),
    "/oauth/authorize?foo=bar",
  );
  assert.equal(normalizeVercelRequestUrl(`${VERCEL_EXPRESS_BRIDGE}`), "/");
  assert.equal(normalizeVercelRequestUrl("/sitemap.xml"), "/sitemap.xml");
  assert.equal(normalizeVercelRequestUrl("/prompts?q=1"), "/api/prompts?q=1");
});

test("publicAppUrl prefers PUBLIC_APP_URL, then request host, then VERCEL_URL", () => {
  const prev = {
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
  };
  try {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.REPLIT_DOMAINS;

    process.env.PUBLIC_APP_URL = "https://app.example.com/";
    assert.equal(publicAppUrl(), "https://app.example.com");

    delete process.env.PUBLIC_APP_URL;
    const req = {
      protocol: "http",
      get(name: string) {
        if (name === "x-forwarded-proto") return "https";
        if (name === "x-forwarded-host") return "preview.example.com";
        return undefined;
      },
    };
    assert.equal(publicAppUrl(req), "https://preview.example.com");

    process.env.VERCEL_URL = "my-app.vercel.app";
    assert.equal(publicAppUrl(), "https://my-app.vercel.app");
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Vercel config builds the Vite app and Express serverless entry from repo root", () => {
  const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
  const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const access = readFileSync(join(apiRoot, "src/routes/access.ts"), "utf8");
  const vite = readFileSync(join(repoRoot, "artifacts/prompt-marketplace/vite.config.ts"), "utf8");
  const handler = readFileSync(join(repoRoot, "api/index.ts"), "utf8");

  assert.equal(vercel.framework, null);
  assert.equal(vercel.installCommand, "pnpm install");
  assert.equal(vercel.buildCommand, "pnpm --filter @workspace/prompt-marketplace run build");
  assert.equal(vercel.outputDirectory, "artifacts/prompt-marketplace/dist/public");
  assert.equal(vercel.rewrites[0].source, "/api/:path*");
  assert.equal(vercel.rewrites[0].destination, "/api");
  assert.match(rootPkg.packageManager, /^pnpm@/);
  assert.equal(rootPkg.dependencies?.["@replit/connectors-sdk"], undefined);
  assert.match(handler, /from "\.\.\/artifacts\/api-server\/src\/app"/);
  assert.match(access, /from "\.\.\/lib\/publicAppUrl"/);
  assert.match(access, /from "\.\.\/lib\/whopHttp"/);
  assert.doesNotMatch(access, /REPLIT_DOMAINS/);
  assert.doesNotMatch(access, /REPLIT_CONNECTORS_HOSTNAME/);
  assert.match(vite, /process\.env\.PORT \|\| '5173'/);
  assert.match(vite, /process\.env\.BASE_PATH \|\| '\/'/);
});
