import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ArrowRight, Copy, Check, Heart, ChevronRight,
  Building2, User, Flame,
} from "lucide-react";
import { Layout } from "@/components/layout";
import {
  useListPrompts,
  useListCategories,
  useGetTrendingPrompts,
  useGetFeaturedCreators,
  type Prompt,
  type User as ApiUser,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Helpers ─────────────────────────────────────────────── */
type Accent = { color: string; subtle: string; label: string };

function categoryAccent(slug: string | null): Accent | null {
  if (slug === "finance") return { color: "var(--orange)", subtle: "var(--orange-subtle)", label: "Finance" };
  if (slug === "law") return { color: "var(--forest)", subtle: "var(--forest-subtle)", label: "Law" };
  return null;
}

function useSubcategories(slug: string | null) {
  const [data, setData] = useState<Array<{ id: number; name: string; slug: string }> | null>(null);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  useEffect(() => {
    if (!slug) { setData(null); return; }
    let cancelled = false;
    fetch(`${base}/api/categories/${slug}/subcategories`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [slug, base]);
  return data;
}

/* ─── Prompt card ─────────────────────────────────────────── */
function PromptCard({ prompt }: { prompt: Prompt }) {
  const [copied, setCopied] = useState(false);
  const isFirm = prompt.authorOrgType === "firm";
  const accent = categoryAccent(
    prompt.categoryName?.toLowerCase() === "finance" ? "finance"
    : prompt.categoryName?.toLowerCase() === "law" ? "law"
    : null
  );

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Link href={`/prompt/${prompt.id}`} className="group block" data-testid={`prompt-card-${prompt.id}`}>
      <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">

        {/* Category tag + save count */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={accent
              ? { background: accent.subtle, color: accent.color }
              : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)" }}
          >
            {prompt.subcategoryName ?? prompt.categoryName}
          </span>
          <span
            className="flex items-center gap-1 text-[11px] tabular-nums font-medium"
            style={{ color: "var(--orange)" }}
          >
            <Heart className="h-3 w-3" fill={prompt.saveCount > 0 ? "currentColor" : "none"} strokeWidth={prompt.saveCount > 0 ? 0 : 1.5} />
            {prompt.saveCount}
          </span>
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <h3 className="font-semibold text-[15px] leading-snug mb-1.5 text-foreground group-hover:text-foreground/70 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
          <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-2">
            {prompt.description ?? prompt.content.slice(0, 90) + "…"}
          </p>
        </div>

        {/* Author credibility */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
          <div className="flex items-center gap-1.5 min-w-0">
            {isFirm ? (
              <>
                <Building2 className="h-3 w-3 shrink-0" style={{ color: accent?.color ?? "var(--orange)" }} />
                <span
                  className="text-[12px] font-semibold truncate"
                  style={{ color: accent?.color ?? "var(--orange)" }}
                >
                  {prompt.authorOrgName ?? prompt.authorDisplayName}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-foreground/40 truncate">{prompt.authorDisplayName}</span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/50 font-medium"
            data-testid={`copy-btn-${prompt.id}`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </Link>
  );
}

/* ─── Firm spotlight (inside category context) ────────────── */
function FirmSpotlight({
  firms,
  accent,
}: {
  firms: (ApiUser & { orgName?: string | null })[];
  accent: Accent;
}) {
  if (!firms.length) return null;
  return (
    <div
      className="border-b px-6 py-3"
      style={{ background: accent.subtle, borderColor: `${accent.color}18` }}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 overflow-x-auto min-w-0">
          <span
            className="text-[11px] font-bold uppercase tracking-widest shrink-0"
            style={{ color: accent.color }}
          >
            {accent.label} experts
          </span>
          <div className="flex items-center gap-3 overflow-x-auto">
            {firms.map((f) => (
              <Link
                key={f.id}
                href={`/profile/${f.username}`}
                className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-[0_1px_6px_rgba(0,0,0,0.07)] hover:shadow-[0_3px_14px_rgba(0,0,0,0.10)] transition-shadow shrink-0 border border-black/[0.04]"
                data-testid={`firm-spotlight-${f.username}`}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                  style={{ background: accent.color }}
                >
                  {((f as any).orgName ?? f.displayName)[0]}
                </div>
                <div>
                  <p className="text-[12px] font-semibold leading-tight" style={{ color: accent.color }}>
                    {(f as any).orgName ?? f.displayName}
                  </p>
                  <p className="text-[10px] text-foreground/40 leading-tight">{f.promptCount} prompts</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<{ id: number; slug: string } | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);

  const { data: categories, isLoading: catsLoading } = useListCategories();
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts({
    ...(activeCategory ? { categoryId: activeCategory.id } : {}),
    ...(activeSubcategoryId != null ? { subcategoryId: activeSubcategoryId } : {}),
    limit: 12,
  } as any);
  const { data: trending } = useGetTrendingPrompts({ limit: 4 });
  const { data: creators } = useGetFeaturedCreators({ limit: 16 });

  const subcategories = useSubcategories(activeCategory?.slug ?? null);
  const accent = categoryAccent(activeCategory?.slug ?? null);

  // Filter firm curators for active category
  const categoryFirms = (creators ?? []).filter(
    (c) => (c as any).orgType === "firm" &&
      (c.categories ?? []).some((cat) => activeCategory && cat === activeCategory.slug)
  ) as (ApiUser & { orgName?: string | null })[];

  // Split all curators for bottom section
  const financeFirms = (creators ?? []).filter((c) => (c as any).orgType === "firm" && (c.categories ?? []).includes("finance"));
  const lawFirms = (creators ?? []).filter((c) => (c as any).orgType === "firm" && (c.categories ?? []).includes("law"));
  const individuals = (creators ?? []).filter((c) => (c as any).orgType !== "firm").slice(0, 6);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLocation(search.trim() ? `/explore?search=${encodeURIComponent(search.trim())}` : "/explore");
  }

  function selectCategory(cat: { id: number; slug: string } | null) {
    setActiveCategory(cat);
    setActiveSubcategoryId(null);
  }

  const prompts = promptsData?.prompts ?? [];

  return (
    <Layout>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="bg-white pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-bold tracking-widest uppercase mb-5" style={{ color: "var(--orange)" }}>
            The prompt library for everyone
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-6 text-foreground">
            Get more from AI.
          </h1>
          <p className="text-xl md:text-2xl text-foreground/50 font-light leading-relaxed mb-10 max-w-xl mx-auto">
            Expert prompts for finance, law, writing, research, and everyday life.
          </p>
          <form onSubmit={handleSearch} className="relative max-w-lg mx-auto" data-testid="hero-search-form">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for any prompt…"
              className="w-full bg-black/[0.04] rounded-2xl pl-11 pr-28 py-4 text-[15px] focus:outline-none focus:ring-2 transition-all placeholder:text-foreground/30 border-0"
              style={{ "--tw-ring-color": "var(--orange)" } as React.CSSProperties}
              data-testid="hero-search-input"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80 transition-opacity"
              style={{ background: "var(--orange)" }}
              data-testid="hero-search-btn"
            >
              Search
            </button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {["Portfolio analysis", "Contract review", "Explain like I'm 5", "Summarize article"].map((q) => (
              <button
                key={q}
                onClick={() => setLocation(`/explore?search=${encodeURIComponent(q)}`)}
                className="text-[13px] px-3.5 py-1.5 rounded-full bg-black/[0.04] text-foreground/50 hover:bg-black/[0.07] hover:text-foreground transition-colors"
                data-testid={`quick-search-${q.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category pills ─────────────────────────────────── */}
      <section className="bg-[#F5F5F7] border-y border-black/[0.05] py-5 px-6 overflow-x-auto">
        <div className="flex items-center gap-2 max-w-6xl mx-auto min-w-max">
          <button
            onClick={() => selectCategory(null)}
            className="px-4 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap bg-foreground text-background"
            style={activeCategory === null ? {} : { background: "white", color: "rgba(0,0,0,0.5)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
            data-testid="category-all"
          >
            All prompts
          </button>

          {catsLoading
            ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
            : categories?.map((cat) => {
                const a = categoryAccent(cat.slug);
                const isActive = activeCategory?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(isActive ? null : { id: cat.id, slug: cat.slug })}
                    className="px-4 py-2 rounded-full text-[13px] font-medium transition-all whitespace-nowrap"
                    style={
                      isActive
                        ? { background: a?.color ?? "#1d1d1f", color: "#fff" }
                        : { background: "white", color: "rgba(0,0,0,0.55)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }
                    }
                    data-testid={`category-${cat.slug}`}
                  >
                    {cat.name}
                  </button>
                );
              })}
        </div>
      </section>

      {/* ── Subcategory chips ──────────────────────────────── */}
      {activeCategory && subcategories && subcategories.length > 0 && (
        <section className="bg-white border-b border-black/[0.04] py-3 px-6 overflow-x-auto">
          <div className="flex items-center gap-2 max-w-6xl mx-auto min-w-max">
            <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: accent?.color ?? "rgba(0,0,0,0.35)" }}>
              {categories?.find((c) => c.id === activeCategory.id)?.name}
            </span>
            <ChevronRight className="h-3 w-3 text-foreground/20" />
            <button
              onClick={() => setActiveSubcategoryId(null)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={
                activeSubcategoryId === null && accent
                  ? { background: accent.subtle, color: accent.color, fontWeight: 600 }
                  : { color: "rgba(0,0,0,0.45)" }
              }
            >
              All
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubcategoryId(activeSubcategoryId === sub.id ? null : sub.id)}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={
                  activeSubcategoryId === sub.id && accent
                    ? { background: accent.color, color: "#fff" }
                    : activeSubcategoryId === sub.id
                    ? { background: "#1d1d1f", color: "#fff" }
                    : { color: "rgba(0,0,0,0.45)" }
                }
                data-testid={`subcategory-${sub.slug}`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Firm spotlight (Finance / Law only) ────────────── */}
      {accent && categoryFirms.length > 0 && (
        <FirmSpotlight firms={categoryFirms} accent={accent} />
      )}

      {/* ── Prompt grid ────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] px-6 pb-16 pt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-xl font-semibold tracking-tight">
              {activeCategory
                ? categories?.find((c) => c.id === activeCategory.id)?.name
                : "Popular prompts"}
              {activeSubcategoryId && subcategories && (
                <span className="text-foreground/50 font-normal">
                  {" · "}
                  {subcategories.find((s) => s.id === activeSubcategoryId)?.name}
                </span>
              )}
            </h2>
            <Link
              href="/explore"
              className="flex items-center gap-0.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors"
              data-testid="view-all-link"
            >
              Browse all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {promptsLoading
              ? Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)
              : prompts.map((p) => <PromptCard key={p.id} prompt={p} />)}
          </div>

          {!promptsLoading && !prompts.length && (
            <div className="text-center py-20 text-foreground/40">No prompts in this category yet.</div>
          )}
        </div>
      </section>

      {/* ── Trending ───────────────────────────────────────── */}
      {trending && trending.length > 0 && (
        <section className="bg-white px-6 py-20 border-t border-black/[0.05]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5" style={{ color: "var(--orange)" }} />
                <h2 className="text-2xl font-bold tracking-tight">Trending this week</h2>
              </div>
              <Link
                href="/explore?sort=trending"
                className="flex items-center gap-0.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors"
              >
                See all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trending.map((prompt) => {
                const a = categoryAccent(
                  prompt.categoryName?.toLowerCase() === "finance" ? "finance"
                  : prompt.categoryName?.toLowerCase() === "law" ? "law"
                  : null
                );
                return (
                  <Link
                    key={prompt.id}
                    href={`/prompt/${prompt.id}`}
                    className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05]"
                    data-testid={`trending-card-${prompt.id}`}
                  >
                    <div
                      className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                      style={{ color: a?.color ?? "rgba(0,0,0,0.35)" }}
                    >
                      {prompt.categoryName}
                    </div>
                    <h3 className="font-semibold text-[14px] leading-snug text-foreground group-hover:text-foreground/70 transition-colors line-clamp-3 mb-3">
                      {prompt.title}
                    </h3>
                    <div
                      className="flex items-center gap-1 text-[12px] tabular-nums font-medium"
                      style={{ color: "var(--orange)" }}
                    >
                      <Heart className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                      {prompt.saveCount} saves
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Top Curators ───────────────────────────────────── */}
      {creators && creators.length > 0 && (
        <section className="bg-[#F5F5F7] px-6 py-20 border-t border-black/[0.05]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight mb-2">Top curators</h2>
              <p className="text-[15px] text-foreground/50">Finance firms, legal practices, and expert creators.</p>
            </div>

            {/* Finance firms */}
            {financeFirms.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "var(--orange)" }} />
                  <h3 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>
                    Finance
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {financeFirms.map((c) => (
                    <Link
                      key={c.id}
                      href={`/profile/${c.username}`}
                      className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.04] flex items-start gap-4"
                      style={{ borderLeft: `3px solid var(--orange)` }}
                      data-testid={`curator-fin-${c.username}`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                        style={{ background: "var(--orange)" }}
                      >
                        {((c as any).orgName ?? c.displayName)[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-[14px] text-foreground truncate">
                            {(c as any).orgName ?? c.displayName}
                          </p>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 text-white"
                            style={{ background: "var(--orange)" }}
                          >
                            FIRM
                          </span>
                        </div>
                        <p className="text-[12px] text-foreground/35">@{c.username}</p>
                        <div className="flex items-center gap-3 mt-2 text-[12px] text-foreground/40">
                          <span>{c.promptCount} prompts</span>
                          <span style={{ color: "var(--orange)" }}>{c.totalSaves} saves</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Law firms */}
            {lawFirms.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "var(--forest)" }} />
                  <h3 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--forest)" }}>
                    Law
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lawFirms.map((c) => (
                    <Link
                      key={c.id}
                      href={`/profile/${c.username}`}
                      className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.04] flex items-start gap-4"
                      style={{ borderLeft: `3px solid var(--forest)` }}
                      data-testid={`curator-law-${c.username}`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                        style={{ background: "var(--forest)" }}
                      >
                        {((c as any).orgName ?? c.displayName)[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-[14px] text-foreground truncate">
                            {(c as any).orgName ?? c.displayName}
                          </p>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 text-white"
                            style={{ background: "var(--forest)" }}
                          >
                            FIRM
                          </span>
                        </div>
                        <p className="text-[12px] text-foreground/35">@{c.username}</p>
                        <div className="flex items-center gap-3 mt-2 text-[12px] text-foreground/40">
                          <span>{c.promptCount} prompts</span>
                          <span style={{ color: "var(--forest)" }}>{c.totalSaves} saves</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Individual creators */}
            {individuals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-3.5 w-3.5 text-foreground/35" />
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-foreground/35">
                    Individual creators
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {individuals.map((c) => (
                    <Link
                      key={c.id}
                      href={`/profile/${c.username}`}
                      className="group bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.04] flex flex-col items-center text-center gap-2"
                      data-testid={`creator-${c.username}`}
                    >
                      <div className="w-11 h-11 rounded-full bg-black/[0.07] flex items-center justify-center text-lg font-semibold text-foreground/40">
                        {c.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-[13px] text-foreground leading-tight group-hover:text-foreground/70 transition-colors">
                          {c.displayName}
                        </p>
                        <p className="text-[11px] text-foreground/35 mt-0.5">{c.promptCount} prompts</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-24 text-center border-t border-black/[0.05]">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Share what works for you.</h2>
          <p className="text-[17px] text-foreground/50 leading-relaxed mb-9">
            Build a profile, publish your best prompts, and help others get more from AI.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-[15px] text-white hover:opacity-80 transition-opacity"
            style={{ background: "var(--orange)" }}
            data-testid="cta-join-btn"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[13px] text-foreground/30 mt-4">Free. No credit card required.</p>
        </div>
      </section>
    </Layout>
  );
}
