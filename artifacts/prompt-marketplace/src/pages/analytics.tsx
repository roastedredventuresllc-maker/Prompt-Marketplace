import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Heart, ShoppingCart, DollarSign, TrendingUp, BarChart2, Star } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PromptStat = {
  id: number;
  title: string;
  viewCount: number;
  saveCount: number;
  avgRating: number;
  ratingCount: number;
  isPublic: boolean;
  purchaseCount: number;
  revenueCents: number;
};

type Totals = {
  totalViews: number;
  totalSaves: number;
  totalPurchases: number;
  totalRevenueCents: number;
};

type MonthlyRow = { month: string; purchases: number; revenueCents: number };

type AnalyticsData = {
  prompts: PromptStat[];
  totals: Totals;
  monthly: MonthlyRow[];
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.05]">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--orange-subtle)", color: "var(--orange)" }}>
          {icon}
        </div>
        <span className="text-[13px] font-medium text-foreground/50">{label}</span>
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[12px] text-foreground/40 mt-1">{sub}</div>}
    </div>
  );
}

function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-foreground/30 text-[14px]">
        No purchase data in the last 6 months yet.
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => d.revenueCents), 1);

  return (
    <div className="flex items-end gap-3 h-40 px-2">
      {data.map(row => {
        const height = Math.max((row.revenueCents / maxRevenue) * 100, row.revenueCents > 0 ? 4 : 0);
        const label = row.month.slice(5); // "MM" from "YYYY-MM"
        return (
          <div key={row.month} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <div className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--orange)" }}>
              {row.revenueCents > 0 ? dollars(row.revenueCents) : ""}
            </div>
            <div
              className="w-full rounded-t-lg transition-all"
              style={{
                height: `${height}%`,
                minHeight: row.revenueCents > 0 ? 4 : 0,
                background: "var(--orange)",
                opacity: 0.85,
              }}
            />
            <div className="text-[11px] text-foreground/40 font-medium">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= Math.round(rating) ? "var(--orange)" : "rgba(0,0,0,0.15)" }} className="text-sm">★</span>
      ))}
    </span>
  );
}

export default function Analytics() {
  const { isSignedIn, isLoaded } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }

    fetch(`${basePath}/api/analytics`, { credentials: "include" })
      .then(r => {
        if (r.status === 401) throw new Error("auth");
        if (r.status === 404) throw new Error("onboarding");
        if (!r.ok) throw new Error("error");
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || loading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="container mx-auto max-w-5xl px-6 py-12 space-y-6">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <BarChart2 className="h-10 w-10 text-foreground/20" />
          <h1 className="text-xl font-semibold">Sign in to view analytics</h1>
          <Link href="/sign-in" className="text-[14px]" style={{ color: "var(--orange)" }}>Sign in →</Link>
        </div>
      </Layout>
    );
  }

  if (error === "onboarding") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <BarChart2 className="h-10 w-10 text-foreground/20" />
          <h1 className="text-xl font-semibold">Complete your profile first</h1>
          <Link href="/onboarding" className="text-[14px]" style={{ color: "var(--orange)" }}>Set up profile →</Link>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-[14px] text-foreground/50">Try refreshing the page.</p>
        </div>
      </Layout>
    );
  }

  const { totals, monthly, prompts } = data;

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">
        <div className="container mx-auto max-w-5xl px-6 py-12">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-1">Analytics</h1>
            <p className="text-[14px] text-foreground/50">Performance across all your published prompts.</p>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Eye className="h-4 w-4" />} label="Total views" value={totals.totalViews.toLocaleString()} />
            <StatCard icon={<Heart className="h-4 w-4" />} label="Total saves" value={totals.totalSaves.toLocaleString()} />
            <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Purchases" value={totals.totalPurchases.toLocaleString()} />
            <StatCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Revenue"
              value={dollars(totals.totalRevenueCents)}
              sub="before platform fees"
            />
          </div>

          {/* Monthly revenue chart */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.05] mb-8">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-4 w-4" style={{ color: "var(--orange)" }} />
              <h2 className="text-[15px] font-semibold">Monthly revenue (last 6 months)</h2>
            </div>
            <MonthlyChart data={monthly} />
          </div>

          {/* Per-prompt table */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.05] overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05]">
              <h2 className="text-[15px] font-semibold">Prompt breakdown</h2>
            </div>

            {prompts.length === 0 ? (
              <div className="py-16 text-center text-foreground/40 text-[14px]">
                <Star className="h-8 w-8 mx-auto mb-3 opacity-20" />
                You haven't published any prompts yet.{" "}
                <Link href="/create" style={{ color: "var(--orange)" }}>Create one →</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] text-foreground/40 text-left">
                      <th className="px-6 py-3 font-medium">Prompt</th>
                      <th className="px-4 py-3 font-medium text-right">Views</th>
                      <th className="px-4 py-3 font-medium text-right">Saves</th>
                      <th className="px-4 py-3 font-medium text-right">Sales</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                      <th className="px-4 py-3 font-medium text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prompts.map(p => (
                      <tr key={p.id} className="border-b border-black/[0.04] last:border-0 hover:bg-[#fafafa] transition-colors">
                        <td className="px-6 py-3">
                          <Link href={`/prompt/${p.id}`} className="font-medium hover:underline underline-offset-2 line-clamp-1">
                            {p.title}
                          </Link>
                          {!p.isPublic && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-black/[0.06] text-foreground/40 font-medium">DRAFT</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground/60">{p.viewCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground/60">{p.saveCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground/60">{p.purchaseCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: p.revenueCents > 0 ? "var(--orange)" : undefined }}>
                          {p.revenueCents > 0 ? dollars(p.revenueCents) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.ratingCount > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              <Stars rating={p.avgRating} />
                              <span className="text-[11px] text-foreground/40 tabular-nums">({p.ratingCount})</span>
                            </span>
                          ) : (
                            <span className="text-foreground/25">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
