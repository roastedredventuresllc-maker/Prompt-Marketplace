import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, ArrowRight, Copy, Check, Heart, ChevronRight, Building2, User } from "lucide-react";
import { Layout } from "@/components/layout";
import {
  useListPrompts,
  useListCategories,
  useGetTrendingPrompts,
  useGetFeaturedCreators,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Inline subcategories fetcher (until next codegen run) ── */
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

/* ── Prompt card ── */
function PromptCard({ prompt }: {
  prompt: { id: number; title: string; content: string; description?: string | null; categoryName: string; authorDisplayName: string; saveCount: number }
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Link href={`/prompt/${prompt.id}`} className="group block" data-testid={`prompt-card-${prompt.id}`}>
      <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-black/[0.05] text-foreground/60 uppercase tracking-wide">{prompt.categoryName}</span>
          <span className="flex items-center gap-1 text-foreground/40 text-xs tabular-nums"><Heart className="h-3 w-3" />{prompt.saveCount}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[15px] leading-snug mb-1.5 text-foreground group-hover:text-foreground/70 transition-colors line-clamp-2">{prompt.title}</h3>
          <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-2">{prompt.description || prompt.content.slice(0, 90) + "…"}</p>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.05]">
          <span className="text-[12px] text-foreground/40">{prompt.authorDisplayName}</span>
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg bg-black/[0.05] hover:bg-black/[0.08] text-foreground/60 font-medium" data-testid={`copy-btn-${prompt.id}`}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<{ id: number; slug: string } | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);

  const { data: categories, isLoading: catsLoading } = useListCategories();
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts({
    ...(activeCategory ? { categoryId: activeCategory.id } : {}),
    ...(activeSubcategoryId ? { subcategoryId: activeSubcategoryId } : {}),
    limit: 12,
  } as any);
  const { data: trending } = useGetTrendingPrompts({ limit: 4 });
  const { data: creators } = useGetFeaturedCreators({ limit: 8 });
  const subcategories = useSubcategories(activeCategory?.slug ?? null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLocation(search.trim() ? `/explore?search=${encodeURIComponent(search.trim())}` : "/explore");
  }

  function selectCategory(cat: { id: number; slug: string } | null) {
    setActiveCategory(cat);
    setActiveSubcategoryId(null);
  }

  const prompts = promptsData?.prompts ?? [];

  // Split featured creators into firms and individuals
  const firms = (creators ?? []).filter((c) => (c as any).orgType === "firm");
  const individuals = (creators ?? []).filter((c) => (c as any).orgType !== "firm");

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="bg-white pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[12px] font-semibold tracking-widest uppercase text-foreground/40 mb-5">The prompt library for everyone</p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-6 text-foreground">
            Get more from AI.
          </h1>
          <p className="text-xl md:text-2xl text-foreground/50 font-light leading-relaxed mb-10 max-w-xl mx-auto">
            Ready-to-use prompts for finance, law, writing, research, coding, and everyday life.
          </p>
          <form onSubmit={handleSearch} className="relative max-w-lg mx-auto" data-testid="hero-search-form">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-foreground/30 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for any prompt…"
              className="w-full bg-black/[0.04] border-0 rounded-2xl pl-11 pr-28 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all placeholder:text-foreground/30"
              data-testid="hero-search-input"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-foreground text-background px-5 py-2 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity" data-testid="hero-search-btn">
              Search
            </button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {["Portfolio analysis", "Contract review", "Explain like I'm 5", "Summarize article"].map((q) => (
              <button key={q} onClick={() => setLocation(`/explore?search=${encodeURIComponent(q)}`)}
                className="text-[13px] px-3.5 py-1.5 rounded-full bg-black/[0.04] text-foreground/50 hover:bg-black/[0.07] hover:text-foreground transition-colors"
                data-testid={`quick-search-${q.replace(/\s+/g, "-").toLowerCase()}`}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category pills ── */}
      <section className="bg-[#F5F5F7] border-y border-black/[0.05] py-5 px-6 overflow-x-auto">
        <div className="flex items-center gap-2 max-w-6xl mx-auto min-w-max">
          <button onClick={() => selectCategory(null)} className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${activeCategory === null ? "bg-foreground text-background" : "bg-white text-foreground/60 hover:text-foreground shadow-sm"}`} data-testid="category-all">
            All prompts
          </button>
          {catsLoading ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />) :
            categories?.map((cat) => (
              <button key={cat.id} onClick={() => selectCategory(activeCategory?.id === cat.id ? null : { id: cat.id, slug: cat.slug })}
                className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${activeCategory?.id === cat.id ? "bg-foreground text-background" : "bg-white text-foreground/60 hover:text-foreground shadow-sm"}`}
                data-testid={`category-${cat.slug}`}>
                {cat.name}
              </button>
            ))}
        </div>
      </section>

      {/* ── Subcategory pills (shown when category is active and has subcategories) ── */}
      {activeCategory && subcategories && subcategories.length > 0 && (
        <section className="bg-white border-b border-black/[0.05] py-3 px-6 overflow-x-auto">
          <div className="flex items-center gap-2 max-w-6xl mx-auto min-w-max">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mr-1">
              {categories?.find((c) => c.id === activeCategory.id)?.name}
            </span>
            <ChevronRight className="h-3 w-3 text-foreground/20" />
            <button onClick={() => setActiveSubcategoryId(null)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${activeSubcategoryId === null ? "bg-foreground/[0.08] text-foreground font-semibold" : "text-foreground/50 hover:text-foreground"}`}>
              All
            </button>
            {subcategories.map((sub) => (
              <button key={sub.id} onClick={() => setActiveSubcategoryId(activeSubcategoryId === sub.id ? null : sub.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${activeSubcategoryId === sub.id ? "bg-foreground/[0.08] text-foreground font-semibold" : "text-foreground/50 hover:text-foreground"}`}
                data-testid={`subcategory-${sub.slug}`}>
                {sub.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Prompt grid ── */}
      <section className="bg-[#F5F5F7] px-6 pb-16 pt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-xl font-semibold tracking-tight">
              {activeCategory ? categories?.find((c) => c.id === activeCategory.id)?.name : "Popular prompts"}
              {activeSubcategoryId && subcategories && <span className="text-foreground/50 font-normal"> · {subcategories.find((s) => s.id === activeSubcategoryId)?.name}</span>}
            </h2>
            <Link href="/explore" className="flex items-center gap-0.5 text-[13px] text-foreground/50 hover:text-foreground transition-colors" data-testid="view-all-link">
              Browse all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {promptsLoading ? Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />) :
              prompts.map((p) => <PromptCard key={p.id} prompt={p} />)}
          </div>
          {!promptsLoading && prompts.length === 0 && (
            <div className="text-center py-20 text-foreground/40">No prompts in this category yet.</div>
          )}
        </div>
      </section>

      {/* ── Trending ── */}
      {trending && trending.length > 0 && (
        <section className="bg-white px-6 py-20 border-t border-black/[0.05]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Trending this week</h2>
              <Link href="/explore?sort=trending" className="flex items-center gap-0.5 text-[13px] text-foreground/50 hover:text-foreground transition-colors">
                See all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trending.map((prompt) => (
                <Link key={prompt.id} href={`/prompt/${prompt.id}`} className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05]" data-testid={`trending-card-${prompt.id}`}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/40 mb-2">{prompt.categoryName}</div>
                  <h3 className="font-semibold text-[14px] leading-snug text-foreground group-hover:text-foreground/70 transition-colors line-clamp-3 mb-3">{prompt.title}</h3>
                  <div className="flex items-center gap-1 text-[12px] text-foreground/40 tabular-nums"><Heart className="h-3 w-3" />{prompt.saveCount} saves</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Top Curators ── */}
      {creators && creators.length > 0 && (
        <section className="bg-[#F5F5F7] px-6 py-20 border-t border-black/[0.05]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight mb-2">Top curators</h2>
              <p className="text-[15px] text-foreground/50">Finance firms, law practices, and expert creators publishing their best prompts.</p>
            </div>

            {/* Firm curators */}
            {firms.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-foreground/40" />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground/40">Organizations</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {firms.map((curator) => (
                    <Link key={curator.id} href={`/profile/${curator.username}`} className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05] flex items-start gap-4" data-testid={`curator-firm-${curator.username}`}>
                      <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center text-background text-lg font-bold shrink-0">
                        {(curator as any).orgName?.[0] ?? curator.displayName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-[14px] text-foreground truncate group-hover:text-foreground/70 transition-colors">
                            {(curator as any).orgName ?? curator.displayName}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-semibold shrink-0">FIRM</span>
                        </div>
                        <p className="text-[12px] text-foreground/40">@{curator.username}</p>
                        <div className="flex items-center gap-3 mt-2 text-[12px] text-foreground/40">
                          <span className="tabular-nums">{curator.promptCount} prompts</span>
                          <span className="tabular-nums">{curator.totalSaves} saves</span>
                        </div>
                        {curator.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {curator.categories.slice(0, 3).map((cat) => (
                              <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.05] text-foreground/50">{cat}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Individual curators */}
            {individuals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-foreground/40" />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground/40">Individual creators</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {individuals.map((creator) => (
                    <Link key={creator.id} href={`/profile/${creator.username}`} className="group bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05] flex items-center gap-4" data-testid={`creator-card-${creator.username}`}>
                      <div className="w-12 h-12 rounded-full bg-black/[0.06] flex items-center justify-center text-lg font-semibold text-foreground/50 shrink-0">
                        {creator.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] text-foreground truncate group-hover:text-foreground/70 transition-colors">{creator.displayName}</p>
                        <p className="text-[12px] text-foreground/40 mt-0.5">{creator.promptCount} prompts</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {creator.categories.slice(0, 2).map((cat) => (
                            <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.05] text-foreground/50">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="bg-white px-6 py-24 text-center border-t border-black/[0.05]">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Share what works for you.</h2>
          <p className="text-[17px] text-foreground/50 leading-relaxed mb-9">Build a profile, publish your best prompts, and help millions of people get more out of AI.</p>
          <Link href="/sign-up" className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-3.5 rounded-full font-medium text-[15px] hover:opacity-80 transition-opacity" data-testid="cta-join-btn">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[13px] text-foreground/30 mt-4">Free. No credit card required.</p>
        </div>
      </section>
    </Layout>
  );
}
