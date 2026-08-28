/**
 * Vercel Node entry. Express is pre-bundled during buildCommand so packing
 * this file does not typecheck the workspace graph or require DATABASE_URL.
 */
export { default } from "../artifacts/api-server/dist/vercelHandler.mjs";
