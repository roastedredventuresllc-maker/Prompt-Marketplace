import { Router } from "express";
import { db, promptsTable, usersTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();
const BASE_URL = "https://promptly.ai";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const [prompts, users] = await Promise.all([
    db.select({ id: promptsTable.id, updatedAt: promptsTable.updatedAt })
      .from(promptsTable)
      .where(and(eq(promptsTable.isPublic, true), isNull(promptsTable.deletedAt))),
    db.select({ username: usersTable.username, createdAt: usersTable.createdAt })
      .from(usersTable),
  ]);

  const entries: string[] = [];

  // Static pages
  entries.push(`  <url><loc>${esc(BASE_URL)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
  entries.push(`  <url><loc>${esc(BASE_URL)}/explore</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>`);

  // Prompt pages
  for (const p of prompts) {
    const lastmod = p.updatedAt.toISOString().split("T")[0];
    entries.push(`  <url><loc>${esc(`${BASE_URL}/prompt/${p.id}`)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  // Creator profiles
  for (const u of users) {
    const lastmod = u.createdAt.toISOString().split("T")[0];
    entries.push(`  <url><loc>${esc(`${BASE_URL}/profile/${u.username}`)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
