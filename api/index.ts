import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../artifacts/api-server/src/app";
import { restoreVercelApiUrl } from "../artifacts/api-server/src/lib/vercelRequestUrl";

/**
 * Single Vercel Node function for the Express app.
 * vercel.json rewrites /api/:path* here and passes the rest as ?__path=.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (typeof req.url === "string") {
    req.url = restoreVercelApiUrl(req.url);
  }
  return app(req, res);
}
