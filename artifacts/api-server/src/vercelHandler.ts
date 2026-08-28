import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { normalizeVercelRequestUrl } from "./lib/vercelRequestUrl";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (typeof req.url === "string") {
    req.url = normalizeVercelRequestUrl(req.url);
  }
  return app(req, res);
}
