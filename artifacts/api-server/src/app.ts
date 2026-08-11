import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { bearerAuthMiddleware } from "./middlewares/bearerAuthMiddleware";
import router from "./routes";
import discoveryRouter from "./routes/discovery";
import sitemapRouter from "./routes/sitemap";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Discovery + sitemap routes — served at root, before /api, no auth needed
app.use(discoveryRouter);
app.use(sitemapRouter);

// OAuth 2.0 well-known metadata — must be at root before Clerk middleware

/** Derive the base origin, honouring Replit's TLS-terminating proxy.
 *  Inside Replit (dev + prod) TLS terminates at the proxy so req.protocol
 *  is always "http". The real scheme is in x-forwarded-proto. */
function getOrigin(req: Parameters<Parameters<typeof app.get>[1]>[0]) {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

// RFC 9728: Protected Resource Metadata — Claude checks THIS first to find the auth server
app.get("/.well-known/oauth-protected-resource", (req, res) => {
  const origin = getOrigin(req);
  res.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header", "query"],
    resource_documentation: `${origin}/api/mcp`,
  });
});

// RFC 8414: Authorization Server Metadata — Claude fetches this after the above
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const origin = getOrigin(req);
  res.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// OAuth authorize — redirect the browser to the React frontend page.
// Uses /connect/claude so it falls outside the /oauth path that routes to the API server.
app.get("/oauth/authorize", (req, res) => {
  const params = new URLSearchParams(req.query as Record<string, string>);
  res.redirect(`/connect/claude?${params.toString()}`);
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Resolve bearer API keys on every request so route handlers can use req.apiKey
app.use(bearerAuthMiddleware);

app.use("/api", router);

export default app;
