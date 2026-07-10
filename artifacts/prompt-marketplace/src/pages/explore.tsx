import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListCategories, useListPrompts, ListPromptsSort } from "@workspace/api-client-react";
import { Search, Heart, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

// Inline subcategories hook (fetch until codegen generates it)
function useSubcategories(slug: string | null) {
  const [data, setData] = useState<Array<{ id: number; name: string; slug: string }> | null>(null);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  useEffect(() => {
    if (!slug) { setData(null); return; }
    fetch(`${basePath}/api/categories/${slug}/subcategories`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [slug, basePath]);
  return data;
}

export default function Explore() {
  const urlParams = new URLSearchParams(window.location.search);

  const [search, setSearch] = useState(urlParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 400);
  const [activeCategory, setActiveCategory] = useState<{ id: number; slug: string } | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [sort, setSort] = useState<ListPromptsSort>(
    (urlParams.get("sort") as ListPromptsSort) || ListPromptsSort.trending
  );
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const subcategories = useSubcategories(activeCategory?.slug ?? null);

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
      <div className="bg-[#f5f5f7] min-h-full">
        {/* Top bar */}
        <div className="bg-white border-b border-black/[0.06] px-6 py-4">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts…"
                  className="w-full bg-[#f5f5f7] rounded-xl pl-11 pr-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 border-0"
                  data-testid="explore-search-input"
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {[
                  { value: ListPromptsSort.trending, label: "Trending" },
                  { value: ListPromptsSort.newest, label: "Newest" },
                  { value: ListPromptsSort.most_saved, label: "Most saved" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      sort === opt.value
                        ? "bg-foreground text-background"
                        : "bg-[#f5f5f7] text-foreground/60 hover:text-foreground"
                    }`}
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
                className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeCategory === null
                    ? "bg-foreground text-background"
                    : "bg-[#f5f5f7] text-foreground/60 hover:text-foreground"
                }`}
                data-testid="category-all"
              >
                All
              </button>
              {categoriesLoading
                ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
                : categories?.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(activeCategory?.id === cat.id ? null : { id: cat.id, slug: cat.slug })}
                      className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                        activeCategory?.id === cat.id
                          ? "bg-foreground text-background"
                          : "bg-[#f5f5f7] text-foreground/60 hover:text-foreground"
                      }`}
                      data-testid={`category-btn-${cat.id}`}
                    >
                      {cat.name}
                      {cat.promptCount > 0 && (
                        <span className="ml-1.5 opacity-50 tabular-nums text-[11px]">{cat.promptCount}</span>
                      )}
                    </button>
                  ))}
            </div>
          </div>
        </div>

        {/* Subcategory pills — only visible when a category is active and has subcategories */}
        {activeCategory && subcategories && subcategories.length > 0 && (
          <div className="bg-white/70 border-b border-black/[0.04] px-6 py-2.5 overflow-x-auto">
            <div className="container mx-auto max-w-6xl">
              <div className="flex items-center gap-2 min-w-max">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mr-1">
                  {categories?.find((c) => c.id === activeCategory.id)?.name}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-foreground/20" />
                <button
                  onClick={() => setActiveSubcategoryId(null)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                    activeSubcategoryId === null
                      ? "bg-foreground/[0.08] text-foreground font-semibold"
                      : "text-foreground/50 hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubcategoryId(activeSubcategoryId === sub.id ? null : sub.id)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                      activeSubcategoryId === sub.id
                        ? "bg-foreground/[0.08] text-foreground font-semibold"
                        : "text-foreground/50 hover:text-foreground"
                    }`}
                    data-testid={`subcategory-btn-${sub.id}`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="container mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[14px] text-foreground/50">
              {promptsLoading ? "Loading…" : `${promptsData?.total ?? 0} prompts`}
              {activeCategory && (
                <span className="ml-1 font-medium text-foreground">
                  in {categories?.find((c) => c.id === activeCategory.id)?.name}
                  {activeSubcategoryId && subcategories && ` › ${subcategories.find((s) => s.id === activeSubcategoryId)?.name}`}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {promptsLoading
              ? Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)
              : promptsData?.prompts.map((prompt) => (
                  <Link
                    key={prompt.id}
                    href={`/prompt/${prompt.id}`}
                    className="group block"
                    data-testid={`prompt-card-${prompt.id}`}
                  >
                    <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300 border border-black/[0.05]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-black/[0.05] text-foreground/60 uppercase tracking-wide">
                          {prompt.subcategoryName ?? prompt.categoryName}
                        </span>
                        <span className="flex items-center gap-1 text-foreground/40 text-xs tabular-nums">
                          <Heart className="h-3 w-3" />
                          {prompt.saveCount}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">
                          {prompt.title}
                        </h3>
                        <p className="text-[13px] text-foreground/50 line-clamp-2 leading-relaxed">
                          {prompt.description ?? prompt.content.slice(0, 80) + "…"}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-black/[0.05] text-[12px] text-foreground/40">
                        {prompt.authorDisplayName}
                      </div>
                    </div>
                  </Link>
                ))}
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
