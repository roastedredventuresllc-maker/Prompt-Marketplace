import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListCategories, useListPrompts, ListPromptsSort, type Prompt } from "@workspace/api-client-react";
import { Search, Heart, ChevronRight, Copy, Check, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

/* ─── Helpers ──────────────────────────────────────────────── */
type Accent = { color: string; subtle: string };

function categoryAccent(_slug: string | null): Accent {
  return { color: "var(--orange)", subtle: "var(--orange-subtle)" };
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

/* ─── Prompt card ──────────────────────────────────────────── */
function PromptCard({ prompt }: { prompt: Prompt }) {
  const [copied, setCopied] = useState(false);
  const isFirm = prompt.authorOrgType === "firm";
  const accent = categoryAccent(prompt.categoryName?.toLowerCase() ?? null);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (prompt.isGated !== false) return;
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Link href={`/prompt/${prompt.id}`} className="group block" data-testid={`prompt-card-${prompt.id}`}>
      <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">

        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: accent.subtle, color: accent.color }}
          >
            {prompt.subcategoryName ?? prompt.categoryName}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {(prompt as any).avgRating > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] tabular-nums font-medium" style={{ color: "var(--orange)" }}>
                ★ {((prompt as any).avgRating as number).toFixed(1)}
              </span>
            )}
            <span
              className="flex items-center gap-1 text-[11px] tabular-nums font-medium"
              style={{ color: "var(--orange)" }}
            >
              <Heart className="h-3 w-3" fill={prompt.saveCount > 0 ? "currentColor" : "none"} strokeWidth={prompt.saveCount > 0 ? 0 : 1.5} />
              {prompt.saveCount}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
          <p className="text-[13px] text-foreground/50 line-clamp-2 leading-relaxed">
            {prompt.description ?? prompt.content.slice(0, 80) + "…"}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
          <div className="flex items-center gap-1.5 min-w-0">
            {isFirm ? (
              <>
                <Building2 className="h-3 w-3 shrink-0" style={{ color: accent.color }} />
                <span className="text-[12px] font-semibold truncate" style={{ color: accent.color }}>
                  {prompt.authorOrgName ?? prompt.authorDisplayName}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-foreground/40 truncate">{prompt.authorDisplayName}</span>
            )}
          </div>
          {prompt.isGated === false && (
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/50 font-medium"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function Explore() {
  const urlParams = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(urlParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 400);
  const [activeCategory, setActiveCategory] = useState<{ id: number; slug: string } | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [sort, setSort] = useState<ListPromptsSort>(
    (urlParams.get("sort") as ListPromptsSort) || ListPromptsSort.trending
  );

  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const subcategories = useSubcategories(activeCategory?.slug ?? null);
  const accent = categoryAccent(activeCategory?.slug ?? null);

  const { data: promptsData, isLoading: promptsLoading } = useListPrompts({
    search: debouncedSearch || null,
    categoryId: activeCategory?.id ?? null,
    subcategoryId: activeSubcategoryId ?? null,
    sort,
    limit: 24,
  } as any);

  function selectCategory(cat: { id: number; slug: string } | null) {
    setActiveCategory(cat);
    setActiveSubcategoryId(null);
  }

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* Top bar — search + sort */}
        <div className="bg-white border-b border-black/[0.06] px-6 py-4">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts…"
                  className="w-full bg-[#F5F5F7] rounded-xl pl-11 pr-4 py-2.5 text-[14px] focus:outline-none border-0"
                  style={{ outline: "none" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${accent?.color ?? "#1d1d1f"}30`)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  data-testid="explore-search-input"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {[
                  { value: ListPromptsSort.trending, label: "Trending" },
                  { value: ListPromptsSort.newest, label: "Newest" },
                  { value: ListPromptsSort.most_saved, label: "Most saved" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                    style={
                      sort === opt.value
                        ? { background: accent?.color ?? "#1d1d1f", color: "#fff" }
                        : { background: "#F5F5F7", color: "rgba(0,0,0,0.5)" }
                    }
                    data-testid={`sort-btn-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category pills */}
        <div className="bg-white border-b border-black/[0.06] px-6 py-3 overflow-x-auto">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-2 min-w-max">
              <button
                onClick={() => selectCategory(null)}
                className="px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all"
                style={activeCategory === null
                  ? { background: "#1d1d1f", color: "#fff" }
                  : { background: "#F5F5F7", color: "rgba(0,0,0,0.5)" }}
                data-testid="category-all"
              >
                All
              </button>
              {categoriesLoading
                ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
                : categories?.map((cat) => {
                    const a = categoryAccent(cat.slug);
                    const isActive = activeCategory?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => selectCategory(isActive ? null : { id: cat.id, slug: cat.slug })}
                        className="px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all"
                        style={
                          isActive
                            ? { background: a?.color ?? "#1d1d1f", color: "#fff" }
                            : { background: "#F5F5F7", color: "rgba(0,0,0,0.5)" }
                        }
                        data-testid={`category-btn-${cat.id}`}
                      >
                        {cat.name}
                        {cat.promptCount > 0 && (
                          <span className="ml-1.5 opacity-50 tabular-nums text-[11px]">{cat.promptCount}</span>
                        )}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Subcategory chips — Finance/Law get colored active states */}
        {activeCategory && subcategories && subcategories.length > 0 && (
          <div
            className="border-b px-6 py-2.5 overflow-x-auto"
            style={accent
              ? { background: accent.subtle, borderColor: `${accent.color}18` }
              : { background: "white", borderColor: "rgba(0,0,0,0.04)" }}
          >
            <div className="container mx-auto max-w-6xl">
              <div className="flex items-center gap-2 min-w-max">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest mr-1 shrink-0"
                  style={{ color: accent?.color ?? "rgba(0,0,0,0.35)" }}
                >
                  {categories?.find((c) => c.id === activeCategory.id)?.name}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-foreground/20" />
                <button
                  onClick={() => setActiveSubcategoryId(null)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all"
                  style={activeSubcategoryId === null
                    ? { background: accent?.color ?? "#1d1d1f", color: "#fff" }
                    : { color: accent?.color ?? "rgba(0,0,0,0.5)" }}
                >
                  All
                </button>
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubcategoryId(activeSubcategoryId === sub.id ? null : sub.id)}
                    className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all"
                    style={
                      activeSubcategoryId === sub.id
                        ? { background: accent?.color ?? "#1d1d1f", color: "#fff" }
                        : { color: accent?.color ?? "rgba(0,0,0,0.5)" }
                    }
                    data-testid={`subcategory-btn-${sub.id}`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results grid */}
        <div className="container mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[14px] text-foreground/40">
              {promptsLoading ? "Loading…" : `${promptsData?.total ?? 0} prompts`}
              {activeCategory && (
                <span className="ml-1 font-semibold" style={{ color: accent?.color ?? "#1d1d1f" }}>
                  in {categories?.find((c) => c.id === activeCategory.id)?.name}
                  {activeSubcategoryId && subcategories && ` › ${subcategories.find((s) => s.id === activeSubcategoryId)?.name}`}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {promptsLoading
              ? Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)
              : promptsData?.prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
          </div>

          {!promptsLoading && !promptsData?.prompts.length && (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No prompts found</h3>
              <p className="text-[14px] text-foreground/50">Try a different search or category.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
