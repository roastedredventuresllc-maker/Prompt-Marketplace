import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { PLATFORM_COMMISSION_PERCENT } from "../lib/commission";
import { isPlatformAdmin } from "../lib/platformAdmin";

const router = Router();

function rangeFilter(range: string) {
  switch (range) {
    case "30d": return sql`AND p.created_at >= NOW() - INTERVAL '30 days'`;
    case "90d": return sql`AND p.created_at >= NOW() - INTERVAL '90 days'`;
    case "6m": return sql`AND p.created_at >= NOW() - INTERVAL '6 months'`;
    default: return sql``;
  }
}

async function requireAdmin(req: any, res: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!(await isPlatformAdmin(userId))) {
    res.status(403).json({ error: "Platform administrator access required" });
    return null;
  }
  return userId;
}

router.get("/admin/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  res.json({ isAdmin: Boolean(userId && await isPlatformAdmin(userId)) });
});

router.get("/admin/sales", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;

  const range = ["30d", "90d", "6m", "all"].includes(String(req.query.range))
    ? String(req.query.range)
    : "30d";
  const filter = rangeFilter(range);

  const [totalsResult, monthlyResult, itemResult, creatorResult, transactionResult] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE p.price_cents > 0)::int AS transaction_count,
        coalesce(sum(p.price_cents) FILTER (WHERE p.price_cents > 0), 0)::int AS gross_cents,
        coalesce(sum(p.commission_cents) FILTER (WHERE p.price_cents > 0), 0)::int AS commission_cents,
        coalesce(sum(p.net_cents) FILTER (WHERE p.price_cents > 0), 0)::int AS net_cents,
        coalesce(sum(p.price_cents) FILTER (WHERE p.item_type = 'credit_topup'), 0)::int AS topup_gross_cents
      FROM purchases p
      WHERE p.price_cents > 0 ${filter}
    `),
    db.execute(sql`
      SELECT
        to_char(date_trunc('month', p.created_at), 'YYYY-MM') AS month,
        count(*)::int AS transaction_count,
        coalesce(sum(p.price_cents), 0)::int AS gross_cents,
        coalesce(sum(p.commission_cents), 0)::int AS commission_cents,
        coalesce(sum(p.net_cents), 0)::int AS net_cents
      FROM purchases p
      WHERE p.price_cents > 0 ${filter}
      GROUP BY date_trunc('month', p.created_at)
      ORDER BY date_trunc('month', p.created_at)
    `),
    db.execute(sql`
      SELECT
        p.item_type,
        p.item_id,
        coalesce(pr.title, l.name, 'Unknown item') AS title,
        coalesce(pr.author_username, l.author_username) AS creator_username,
        count(*)::int AS transaction_count,
        coalesce(sum(p.price_cents), 0)::int AS gross_cents,
        coalesce(sum(p.commission_cents), 0)::int AS commission_cents,
        coalesce(sum(p.net_cents), 0)::int AS net_cents
      FROM purchases p
      LEFT JOIN prompts pr ON p.item_type = 'prompt' AND pr.id = p.item_id
      LEFT JOIN libraries l ON p.item_type = 'library' AND l.id = p.item_id
      WHERE p.price_cents > 0
        AND p.item_type IN ('prompt', 'library') ${filter}
      GROUP BY p.item_type, p.item_id, pr.title, l.name, pr.author_username, l.author_username
      ORDER BY gross_cents DESC
      LIMIT 20
    `),
    db.execute(sql`
      SELECT
        coalesce(pr.author_username, l.author_username) AS username,
        coalesce(u.display_name, coalesce(pr.author_username, l.author_username)) AS display_name,
        count(*)::int AS transaction_count,
        coalesce(sum(p.price_cents), 0)::int AS gross_cents,
        coalesce(sum(p.commission_cents), 0)::int AS commission_cents,
        coalesce(sum(p.net_cents), 0)::int AS net_cents
      FROM purchases p
      LEFT JOIN prompts pr ON p.item_type = 'prompt' AND pr.id = p.item_id
      LEFT JOIN libraries l ON p.item_type = 'library' AND l.id = p.item_id
      LEFT JOIN users u ON u.username = coalesce(pr.author_username, l.author_username)
      WHERE p.price_cents > 0
        AND p.item_type IN ('prompt', 'library') ${filter}
      GROUP BY coalesce(pr.author_username, l.author_username), u.display_name
      ORDER BY gross_cents DESC
      LIMIT 20
    `),
    db.execute(sql`
      SELECT
        p.id,
        p.transaction_type,
        p.item_type,
        p.item_id,
        coalesce(pr.title, l.name,
          CASE WHEN p.item_type = 'credit_topup' THEN 'API credit top-up' ELSE 'Unknown item' END
        ) AS title,
        coalesce(pr.author_username, l.author_username) AS creator_username,
        p.price_cents AS gross_cents,
        p.commission_cents,
        p.net_cents,
        p.created_at
      FROM purchases p
      LEFT JOIN prompts pr ON p.item_type = 'prompt' AND pr.id = p.item_id
      LEFT JOIN libraries l ON p.item_type = 'library' AND l.id = p.item_id
      WHERE p.price_cents > 0 ${filter}
      ORDER BY p.created_at DESC
      LIMIT 100
    `),
  ]);

  const totalsRow: any = totalsResult.rows[0] ?? {};
  res.json({
    isAdmin: true,
    commissionRate: PLATFORM_COMMISSION_PERCENT,
    range,
    totals: {
      transactionCount: Number(totalsRow.transaction_count ?? 0),
      grossCents: Number(totalsRow.gross_cents ?? 0),
      commissionCents: Number(totalsRow.commission_cents ?? 0),
      netCents: Number(totalsRow.net_cents ?? 0),
      topupGrossCents: Number(totalsRow.topup_gross_cents ?? 0),
    },
    monthly: (monthlyResult.rows as any[]).map((row) => ({
      month: row.month,
      transactionCount: Number(row.transaction_count),
      grossCents: Number(row.gross_cents),
      commissionCents: Number(row.commission_cents),
      netCents: Number(row.net_cents),
    })),
    topItems: (itemResult.rows as any[]).map((row) => ({
      itemType: row.item_type,
      itemId: Number(row.item_id),
      title: row.title,
      creatorUsername: row.creator_username,
      transactionCount: Number(row.transaction_count),
      grossCents: Number(row.gross_cents),
      commissionCents: Number(row.commission_cents),
      netCents: Number(row.net_cents),
    })),
    topCreators: (creatorResult.rows as any[]).map((row) => ({
      username: row.username,
      displayName: row.display_name,
      transactionCount: Number(row.transaction_count),
      grossCents: Number(row.gross_cents),
      commissionCents: Number(row.commission_cents),
      netCents: Number(row.net_cents),
    })),
    transactions: (transactionResult.rows as any[]).map((row) => ({
      id: Number(row.id),
      transactionType: row.transaction_type,
      itemType: row.item_type,
      itemId: Number(row.item_id),
      title: row.title,
      creatorUsername: row.creator_username,
      grossCents: Number(row.gross_cents),
      commissionCents: Number(row.commission_cents),
      netCents: Number(row.net_cents),
      createdAt: row.created_at,
    })),
  });
});

export default router;