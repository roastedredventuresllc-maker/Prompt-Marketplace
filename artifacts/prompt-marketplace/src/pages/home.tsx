import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Heart, ArrowRight, Copy, Check } from "lucide-react";
import { Layout } from "@/components/layout";
import {
  useListPrompts,
  useListCategories,
  useGetTrendingPrompts,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function PromptCard({ prompt }: { prompt: { id: number; title: string; content: string; description?: string | null; categoryName: string; authorDisplayName: string; saveCount: number } }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5" data-testid={`prompt-card-${prompt.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
          {prompt.categoryName}
        </span>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Heart className="h-3 w-3" />
          <span className="tabular-nums">{prompt.saveCount}</span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
          {prompt.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {prompt.description || prompt.content.slice(0, 100) + "…"}
        </p>
      </div>

      <div className="pt-2 border-t border-border/50 flex items-center justify-between mt-auto">
        <span className="text-xs text-muted-foreground">by {prompt.authorDisplayName}</span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            data-testid={`copy-btn-${prompt.id}`}
          >
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <Link
            href={`/prompt/${prompt.id}`}
            className="text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const { data: categories, isLoading: catsLoading } = useListCategories();
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts(
    activeCategoryId ? { categoryId: activeCategoryId, limit: 12 } : { limit: 12 }
  );
  const { data: trending } = useGetTrendingPrompts({ limit: 3 });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/explore?search=${encodeURIComponent(search.trim())}`);
    } else {
      setLocation("/explore");
    }
  }

  const prompts = promptsData?.prompts ?? [];

  return (
    <Layout>
      <div className="w-full">

        {/* Hero */}
        <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-4">
            Better prompts,<br />
            <span className="text-primary">better results.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Browse thousands of ready-to-use prompts for writing, coding, research, and everyday tasks.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative max-w-xl mx-auto" data-testid="hero-search-form">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full bg-card border border-border rounded-2xl pl-12 pr-32 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground"
              data-testid="hero-search-input"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="hero-search-btn"
            >
              Search
            </button>
          </form>

          {/* Quick links */}
          <div className="flex items-center justify-center gap-2 mt-5 text-sm text-muted-foreground flex-wrap">
            <span>Try:</span>
            {["Rewrite this simply", "Explain like I'm 5", "Write a thank you note", "Summarize this article"].map((q) => (
              <button
                key={q}
                onClick={() => setLocation(`/explore?search=${encodeURIComponent(q)}`)}
                className="text-primary hover:underline underline-offset-2"
                data-testid={`quick-search-${q.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Category pills */}
        <div className="border-y border-border/50 bg-card/30">
          <div className="container mx-auto max-w-6xl px-4 py-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max mx-auto">
              <button
                onClick={() => setActiveCategoryId(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  activeCategoryId === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                data-testid="category-all"
              >
                All prompts
              </button>
              {catsLoading
                ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
                : categories?.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(activeCategoryId === cat.id ? null : cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        activeCategoryId === cat.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`category-${cat.slug}`}
                    >
                      {cat.name}
                    </button>
                  ))}
            </div>
          </div>
        </div>

        {/* Prompt grid */}
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {activeCategoryId
                ? categories?.find((c) => c.id === activeCategoryId)?.name
                : "Popular prompts"}
            </h2>
            <Link
              href="/explore"
              className="text-sm text-primary flex items-center gap-1 hover:gap-2 transition-all"
              data-testid="view-all-link"
            >
              Browse all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {promptsLoading
              ? Array(12).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)
              : prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
          </div>

          {!promptsLoading && prompts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No prompts found in this category yet.
            </div>
          )}
        </div>

        {/* Trending picks strip */}
        {trending && trending.length > 0 && (
          <div className="border-t border-border/50 bg-card/30">
            <div className="container mx-auto max-w-6xl px-4 py-12">
              <h2 className="text-xl font-semibold mb-6">Trending this week</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {trending.map((prompt) => (
                  <Link
                    key={prompt.id}
                    href={`/prompt/${prompt.id}`}
                    className="group flex items-start gap-4 bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all"
                    data-testid={`trending-card-${prompt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">{prompt.categoryName}</div>
                      <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {prompt.title}
                      </h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Heart className="h-3 w-3" />
                        <span className="tabular-nums">{prompt.saveCount} saves</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-border/50">
          <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-3">Share your best prompts</h2>
            <p className="text-muted-foreground mb-8">
              Create a profile, build collections, and help others get more out of AI.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-medium hover:bg-primary/90 transition-colors"
              data-testid="cta-join-btn"
            >
              Get started — it's free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

      </div>
    </Layout>
  );
}
