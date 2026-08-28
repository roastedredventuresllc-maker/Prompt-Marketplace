/**
 * Vercel Node entry for the Express app (`/api` and `/api/`).
 * Non-/api Express routes are rewritten to /api/__express/... in vercel.json
 * and unwrapped in vercelHandler.
 */
export { default } from "../artifacts/api-server/dist/vercelHandler.mjs";
