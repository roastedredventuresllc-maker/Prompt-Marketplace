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
