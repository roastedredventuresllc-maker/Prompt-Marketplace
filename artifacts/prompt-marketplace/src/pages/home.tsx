import { Link } from "wouter";
import { Copy, Heart, Terminal, TrendingUp, Users, Database, Layers, Search } from "lucide-react";
import { Layout } from "@/components/layout";
import { 
  useGetMarketplaceStats, 
  useGetTrendingPrompts, 
  useGetFeaturedCreators 
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({ title, value, icon: Icon, isLoading }: { title: string, value?: number, icon: any, isLoading: boolean }) {
  return (
    <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-colors">
      <div className="bg-muted p-3 rounded-md text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</div>
        {isLoading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <div className="text-2xl font-bold tabular-nums text-foreground tracking-tight">{value?.toLocaleString() ?? 0}</div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetMarketplaceStats();
  const { data: trending, isLoading: trendingLoading } = useGetTrendingPrompts({ limit: 6 });
  const { data: creators, isLoading: creatorsLoading } = useGetFeaturedCreators({ limit: 4 });

  return (
    <Layout>
      <div className="w-full bg-background">
        {/* Hero Section */}
        <div className="container mx-auto max-w-7xl px-4 md:px-8 py-16 md:py-24 lg:py-32">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              MARKETPLACE LIVE
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              The Stock Market for <br/><span className="text-primary">AI Prompts</span>.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Signal over noise. Discover, trade, and implement the highest-performing prompt libraries from top creators.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <Link href="/explore" className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2" data-testid="hero-explore-btn">
                <Search className="h-4 w-4" /> Start Exploring
              </Link>
              <Link href="/onboarding" className="bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/80 transition-colors" data-testid="hero-join-btn">
                Become a Creator
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Ticker */}
        <div className="border-y border-border/50 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <MetricCard title="Total Prompts" value={stats?.totalPrompts} icon={Terminal} isLoading={statsLoading} />
              <MetricCard title="Active Creators" value={stats?.totalCreators} icon={Users} isLoading={statsLoading} />
              <MetricCard title="Total Saves" value={stats?.totalSaves} icon={Heart} isLoading={statsLoading} />
              <MetricCard title="Curated Libs" value={stats?.totalLibraries} icon={Database} isLoading={statsLoading} />
            </div>
          </div>
        </div>

        {/* Trending Rail */}
        <div className="container mx-auto max-w-7xl px-4 md:px-8 py-16 md:py-24">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <TrendingUp className="text-primary h-6 w-6" /> Trending Now
            </h2>
            <Link href="/explore?sort=trending" className="text-sm text-primary font-medium hover:underline">
              View All
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingLoading ? (
              Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))
            ) : trending?.length ? (
              trending.map((prompt) => (
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
                    <h3 className="font-semibold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{prompt.description || "No description provided."}</p>
                    
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
                      <div className="text-xs text-muted-foreground font-mono">
                        {new Date(prompt.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">No trending prompts found.</div>
            )}
          </div>
        </div>

        {/* Featured Creators */}
        <div className="border-t border-border/50 bg-secondary/20">
          <div className="container mx-auto max-w-7xl px-4 md:px-8 py-16 md:py-24">
            <h2 className="text-2xl font-bold flex items-center gap-2 tracking-tight mb-8">
              <Users className="text-primary h-6 w-6" /> Top Creators
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {creatorsLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-lg" />
                ))
              ) : creators?.length ? (
                creators.map((user) => (
                  <Link key={user.id} href={`/profile/${user.username}`} className="group" data-testid={`creator-card-${user.username}`}>
                    <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-all flex items-center gap-4">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-14 h-14 rounded-full border border-border" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold border border-border group-hover:border-primary/50 transition-colors">
                          {user.username.substring(0,2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[120px]">{user.displayName}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">@{user.username}</p>
                        <div className="flex gap-3 mt-2 text-xs font-medium tabular-nums text-muted-foreground">
                          <span className="flex items-center gap-1"><Terminal className="h-3 w-3"/> {user.promptCount}</span>
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3"/> {user.totalSaves}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">No creators found.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
