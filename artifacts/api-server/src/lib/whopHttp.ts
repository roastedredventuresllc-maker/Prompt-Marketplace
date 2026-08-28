const WHOP_API_BASE = "https://api.whop.com";
const DEFAULT_WHOP_PRODUCT_ID = "prod_O9RuGmzn0dt7G";

function replitConnectorAuth(): { hostname: string; token: string } | null {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME?.trim();
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !token) return null;
  return { hostname, token };
}

export function whopProductId(): string {
  return process.env.WHOP_PRODUCT_ID?.trim() || DEFAULT_WHOP_PRODUCT_ID;
}

/**
 * Whop REST helper. Vercel (and any non-Replit host) uses WHOP_API_KEY against
 * api.whop.com. Replit connector proxy is optional fallback only.
 */
export async function whopApi(method: string, path: string, body?: object): Promise<any> {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  const urlPath = path.startsWith("/") ? path : `/${path}`;

  if (apiKey) {
    const resp = await fetch(`${WHOP_API_BASE}${urlPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return resp.json();
  }

  const connector = replitConnectorAuth();
  if (connector) {
    const resp = await fetch(`https://${connector.hostname}/api/v2/proxy/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Replit-Token": connector.token,
        "Connector-Name": "whop",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return resp.json();
  }

  throw new Error("WHOP_API_KEY is not set");
}
