/**
 * Restore Express paths after vercel.json rewrites everything to /api.
 * /api/:path* arrives as /api?__path=:path*
 * Root Express routes (well-known, oauth, sitemap) arrive as /api?__orig=<full path>
 */
export function restoreVercelApiUrl(url: string): string {
  const q = url.indexOf("?");
  const search = q === -1 ? "" : url.slice(q + 1);
  const params = new URLSearchParams(search);
  const orig = params.get("__orig");
  const nested = params.get("__path");
  params.delete("__orig");
  params.delete("__path");
  const rest = params.toString();
  const qs = rest ? `?${rest}` : "";

  if (orig) {
    const path = orig.startsWith("/") ? orig : `/${orig}`;
    return `${path}${qs}`;
  }

  if (nested != null && nested !== "") {
    return `/api/${nested.replace(/^\/+/, "")}${qs}`;
  }

  return url;
}

export const VERCEL_EXPRESS_BRIDGE = "/api/__express";

/**
 * Map Vercel rewrites for non-/api Express routes back to the paths Express mounts.
 * /api/* is served by api/index.mjs and api/[...path].mjs without a rewrite.
 */
export function normalizeVercelRequestUrl(url: string): string {
  const q = url.indexOf("?");
  const pathname = q === -1 ? url : url.slice(0, q);
  const search = q === -1 ? "" : url.slice(q);

  if (pathname === VERCEL_EXPRESS_BRIDGE || pathname.startsWith(`${VERCEL_EXPRESS_BRIDGE}/`)) {
    return `${pathname.slice(VERCEL_EXPRESS_BRIDGE.length) || "/"}${search}`;
  }

  // api/[...path] sometimes presents the URL without the /api prefix.
  if (
    pathname !== "/api" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/.well-known") &&
    pathname !== "/oauth" &&
    !pathname.startsWith("/oauth/") &&
    pathname !== "/llms.txt" &&
    pathname !== "/openapi.json" &&
    pathname !== "/sitemap.xml"
  ) {
    return `/api${pathname.startsWith("/") ? pathname : `/${pathname}`}${search}`;
  }

  return url;
}
