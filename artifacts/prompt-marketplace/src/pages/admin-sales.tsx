import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert,
  AlertCircle,
  DollarSign,
  Activity,
  ArrowRightLeft,
  CreditCard,
  User,
  Package,
  Layers,
  FileText,
  PieChart,
  BarChart2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Range = "30d" | "90d" | "6m" | "all";

type Totals = {
  transactionCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  topupGrossCents: number;
};

type MonthlyRow = {
  month: string;
  transactionCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

type TopItem = {
  itemType: string;
  itemId: number;
  title: string;
  creatorUsername: string;
  transactionCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

type TopCreator = {
  username: string;
  displayName: string;
  transactionCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

type Transaction = {
  id: number;
  transactionType: string;
  itemType: string | null;
  itemId: number | null;
  title: string | null;
  creatorUsername: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  createdAt: string;
};

type AdminSalesData = {
  isAdmin: boolean;
  commissionRate: number;
  totals: Totals;
  monthly: MonthlyRow[];
  topItems: TopItem[];
  topCreators: TopCreator[];
  transactions: Transaction[];
};

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-card rounded-2xl p-6 shadow-sm border ${highlight ? 'border-primary/30 ring-1 ring-primary/10' : 'border-border'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${highlight ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          {icon}
        </div>
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-card-foreground">{value}</div>
      {sub && <div className="text-[12px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <Package className="h-8 w-8 text-muted-foreground/30 mb-3" />
      <h3 className="text-[14px] font-medium text-foreground/70">{title}</h3>
      <p className="text-[13px] text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}

function ItemLink({ type, id, title }: { type: string, id: number, title: string }) {
  const href = type === 'library' ? `/library/${id}` : `/prompt/${id}`;
  const icon = type === 'library' ? <Layers className="inline w-3.5 h-3.5 mr-1" /> : <FileText className="inline w-3.5 h-3.5 mr-1" />;
  
  return (
    <Link href={href} className="font-medium hover:underline underline-offset-2 flex items-center group max-w-[200px]" data-testid={`admin-item-${id}`}>
      <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">{icon}</span>
      <span className="truncate">{title}</span>
    </Link>
  );
}

function UserLink({ username, display }: { username: string, display?: string }) {
  return (
    <Link href={`/profile/${username}`} className="font-medium hover:underline underline-offset-2 flex items-center group max-w-[150px]" data-testid={`admin-user-${username}`}>
      <User className="inline w-3.5 h-3.5 mr-1 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      <span className="truncate">{display || username}</span>
    </Link>
  );
}

function TransactionTypeBadge({ type }: { type: string }) {
  if (type === 'credit_topup') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[rgba(27,92,56,0.1)] text-[#1B5C38] dark:text-[#4ade80] text-[10px] font-semibold uppercase tracking-wider">Top-up</span>;
  }
  if (type === 'prompt_purchase' || type === 'library_purchase' || type === 'purchase') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[rgba(212,97,26,0.1)] text-[#D4611A] dark:text-[#fb923c] text-[10px] font-semibold uppercase tracking-wider">Purchase</span>;
  }
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-semibold uppercase tracking-wider">{type}</span>;
}

function MonthlyRevenueChart({ data }: { data: MonthlyRow[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-[14px]">
        No monthly data available.
      </div>
    );
  }

  return (
    <div className="h-72 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            dy={10}
            tickFormatter={(val: string) => {
              const [y, m] = val.split("-");
              const d = new Date(parseInt(y), parseInt(m) - 1);
              return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
            }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(val) => `$${val / 100}`}
          />
          <Tooltip 
            cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-popover border border-popover-border shadow-md rounded-lg p-3 text-[13px] min-w-[150px]">
                    <div className="font-medium text-popover-foreground mb-3">{label}</div>
                    {payload.map((entry, index) => (
                      <div key={index} className="flex justify-between gap-6 mb-1.5 last:mb-0">
                        <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>
                        <span className="font-semibold text-popover-foreground">${(entry.value as number) / 100}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
          <Bar dataKey="netCents" name="Creator Net" stackId="a" fill="#1B5C38" radius={[0, 0, 4, 4]} />
          <Bar dataKey="commissionCents" name="Commission" stackId="a" fill="#D4611A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminSales() {
  const { isLoaded, isSignedIn } = useAuth();
  const [range, setRange] = useState<Range>("30d");

  const { data, isLoading, error } = useQuery<AdminSalesData, Error>({
    queryKey: ["admin-sales", range],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/admin/sales?range=${range}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        throw new Error("forbidden");
      }
      if (!res.ok) {
        throw new Error("error");
      }
      return res.json();
    },
    enabled: isLoaded && isSignedIn,
  });

  if (!isLoaded || isLoading) {
    return (
      <Layout>
        <div className="bg-secondary/30 min-h-full">
          <div className="container mx-auto max-w-6xl px-6 py-12 space-y-8">
            <div className="flex justify-between">
              <Skeleton className="h-10 w-64 rounded-xl" />
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
            <Skeleton className="h-[350px] rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[400px] rounded-2xl" />
              <Skeleton className="h-[400px] rounded-2xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
          <h1 className="text-2xl font-bold tracking-tight">Sign in required</h1>
          <p className="text-[14px] text-muted-foreground max-w-sm">Please sign in to access the administrator console.</p>
          <Link href="/sign-in" className="mt-2 text-[14px] font-medium text-primary hover:underline" data-testid="admin-signin">Sign in to continue &rarr;</Link>
        </div>
      </Layout>
    );
  }

  if (error?.message === "forbidden" || (data && !data.isAdmin)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive/80 mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
          <p className="text-[14px] text-muted-foreground max-w-md">You do not have permission to view the financial cockpit. This area is strictly reserved for marketplace operators.</p>
          <Link href="/" className="text-[14px] font-medium text-primary hover:underline mt-2" data-testid="admin-home">Return home &rarr;</Link>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/80 mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Failed to load data</h1>
          <p className="text-[14px] text-muted-foreground">The marketplace analytics could not be retrieved at this time.</p>
          <button onClick={() => window.location.reload()} className="mt-2 text-[14px] font-medium text-primary hover:underline" data-testid="admin-reload">Reload page &rarr;</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary/30 min-h-full pb-20">
        <div className="container mx-auto max-w-6xl px-6 py-12">
          
          {/* Header & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Cockpit</h1>
                <span className="bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full tracking-wide" data-testid="admin-commission-rate">
                  {(data.commissionRate * 100).toFixed(1)}% FEE
                </span>
              </div>
              <p className="text-[14px] text-muted-foreground">Marketplace-wide sales, commissions, and top-up volume.</p>
            </div>

            <div className="flex bg-secondary/80 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-border/40 shadow-sm backdrop-blur-sm">
              {(['30d', '90d', '6m', 'all'] as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  data-testid={`admin-filter-${r}`}
                  className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-all ${
                    range === r 
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : r === '6m' ? '6 Months' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Gross Volume"
              value={dollars(data.totals.grossCents)}
              highlight
            />
            <StatCard
              icon={<PieChart className="h-5 w-5" />}
              label="Commission"
              value={dollars(data.totals.commissionCents)}
            />
            <StatCard
              icon={<Activity className="h-5 w-5" />}
              label="Net Creator Earnings"
              value={dollars(data.totals.netCents)}
            />
            <StatCard
              icon={<CreditCard className="h-5 w-5" />}
              label="Wallet Top-ups"
              value={dollars(data.totals.topupGrossCents)}
            />
            <StatCard
              icon={<ArrowRightLeft className="h-5 w-5" />}
              label="Transactions"
              value={data.totals.transactionCount.toLocaleString()}
            />
          </div>

          {/* Chart Row */}
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border mb-8">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-[16px] font-bold tracking-tight text-card-foreground">Revenue Overview</h2>
            </div>
            <MonthlyRevenueChart data={data.monthly} />
          </div>

          {/* Top Items & Top Creators Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Items */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
                <h2 className="text-[15px] font-bold tracking-tight text-card-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Top Items
                </h2>
              </div>
              <div className="flex-1">
                {data.topItems.length === 0 ? (
                  <EmptyState title="No items sold" desc="No sales data for the selected period." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-secondary/10 text-muted-foreground text-left">
                          <th className="px-6 py-3 font-semibold">Item</th>
                          <th className="px-4 py-3 font-semibold text-right">Qty</th>
                          <th className="px-4 py-3 font-semibold text-right">Gross</th>
                          <th className="px-4 py-3 font-semibold text-right">Comms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topItems.map((item, i) => (
                          <tr key={`${item.itemType}-${item.itemId}-${i}`} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                            <td className="px-6 py-3">
                              <ItemLink type={item.itemType} id={item.itemId} title={item.title} />
                              <div className="mt-1">
                                <UserLink username={item.creatorUsername} />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-medium">{item.transactionCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">{dollars(item.grossCents)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--orange)]">{dollars(item.commissionCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Top Creators */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
                <h2 className="text-[15px] font-bold tracking-tight text-card-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Top Creators
                </h2>
              </div>
              <div className="flex-1">
                {data.topCreators.length === 0 ? (
                  <EmptyState title="No creator sales" desc="No creator earnings for the selected period." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-secondary/10 text-muted-foreground text-left">
                          <th className="px-6 py-3 font-semibold">Creator</th>
                          <th className="px-4 py-3 font-semibold text-right">Sales</th>
                          <th className="px-4 py-3 font-semibold text-right">Gross</th>
                          <th className="px-4 py-3 font-semibold text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topCreators.map((creator, i) => (
                          <tr key={`${creator.username}-${i}`} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                            <td className="px-6 py-3">
                              <UserLink username={creator.username} display={creator.displayName} />
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-medium">{creator.transactionCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">{dollars(creator.grossCents)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--forest)]">{dollars(creator.netCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-border bg-secondary/30">
              <h2 className="text-[15px] font-bold tracking-tight text-card-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Recent Transactions
              </h2>
            </div>
            {data.transactions.length === 0 ? (
              <EmptyState title="No transactions" desc="There are no transactions in the selected period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/10 text-muted-foreground text-left">
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Creator</th>
                      <th className="px-4 py-3 font-semibold text-right">Gross</th>
                      <th className="px-4 py-3 font-semibold text-right">Net</th>
                      <th className="px-4 py-3 font-semibold text-right">Comm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map(t => (
                      <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground font-medium tabular-nums">{formatDate(t.createdAt)}</td>
                        <td className="px-4 py-3"><TransactionTypeBadge type={t.transactionType} /></td>
                        <td className="px-4 py-3">
                          {t.itemType && t.itemId ? <ItemLink type={t.itemType} id={t.itemId} title={t.title || 'Unknown'} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {t.creatorUsername ? <UserLink username={t.creatorUsername} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">{dollars(t.grossCents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--forest)]">{dollars(t.netCents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--orange)]">{dollars(t.commissionCents)}</td>
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
