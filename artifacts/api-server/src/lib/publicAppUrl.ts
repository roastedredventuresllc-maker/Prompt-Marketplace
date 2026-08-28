type HeaderRequest = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

function header(req: HeaderRequest | undefined, name: string): string | undefined {
  const raw = req?.get?.(name);
  if (!raw) return undefined;
  return raw.split(",")[0]?.trim() || undefined;
}

/**
 * Public origin for checkout redirects and absolute links.
 * Prefer PUBLIC_APP_URL, then the incoming request (x-forwarded-*), then VERCEL_URL.
 * REPLIT_DOMAINS is only a last-resort fallback for existing Replit deploys.
 */
export function publicAppUrl(req?: HeaderRequest): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const proto = header(req, "x-forwarded-proto") ?? req?.protocol ?? "https";
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  if (host) return `${proto}://${host}`;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  const replit = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replit) return `https://${replit}`;

  return "http://localhost:5173";
}
