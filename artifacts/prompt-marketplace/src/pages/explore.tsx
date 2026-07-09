import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListCategories, useListPrompts, ListPromptsSort } from "@workspace/api-client-react";
import { Search, Filter, Heart, Terminal, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

export default function Explore() {
  const [searchParams] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  
  const [search, setSearch] = useState(urlParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 400);
  
  const [activeCategory, setActiveCategory] = useState<number | null>(
    urlParams.get("category") ? Number(urlParams.get("category")) : null
  );
  
  const [sort, setSort] = useState<ListPromptsSort>(
    (urlParams.get("sort") as ListPromptsSort) || ListPromptsSort.trending
  );

  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts({
    search: debouncedSearch || null,
    categoryId: activeCategory,
    sort,
    limit: 24
  });

  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-12 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Search className="h-4 w-4" /> Search
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search prompts..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                data-testid="explore-search-input"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Filter className="h-4 w-4" /> Sort By
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { value: ListPromptsSort.trending, label: "Trending" },
                { value: ListPromptsSort.newest, label: "Newest" },
                { value: ListPromptsSort.most_saved, label: "Most Saved" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value as ListPromptsSort)}
                  className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sort === opt.value 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  data-testid={`sort-btn-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" /> Categories
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeCategory === null 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                All Categories
              </button>
              {categoriesLoading ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
              ) : categories?.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`text-left px-3 py-2 rounded-md text-sm font-medium flex items-center justify-between transition-colors ${
                    activeCategory === cat.id 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  data-testid={`category-btn-${cat.id}`}
                >
                  <span>{cat.name}</span>
                  <span className="text-xs opacity-50 tabular-nums">{cat.promptCount}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Explore Prompts</h1>
            <div className="text-sm text-muted-foreground font-mono tabular-nums">
              {promptsLoading ? "..." : promptsData?.total || 0} results
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {promptsLoading ? (
              Array(9).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))
            ) : promptsData?.prompts.length ? (
              promptsData.prompts.map((prompt) => (
                <Link key={prompt.id} href={`/prompt/${prompt.id}`} className="group block h-full" data-testid={`prompt-card-${prompt.id}`}>
                  <div className="bg-card border border-border rounded-lg p-5 h-full flex flex-col hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,200,5,0.1)] transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                        {prompt.categoryName}
                      </span>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium tabular-nums">
                        <Heart className="h-3.5 w-3.5" /> {prompt.saveCount}
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{prompt.description || "No description provided."}</p>
                    
                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {prompt.authorAvatarUrl ? (
                          <img src={prompt.authorAvatarUrl} alt={prompt.authorUsername} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {prompt.authorUsername.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-foreground">@{prompt.authorUsername}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                         <Terminal className="h-3 w-3" /> {prompt.viewCount}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border border-dashed border-border rounded-lg">
                <div className="bg-secondary/50 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">No prompts found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}
