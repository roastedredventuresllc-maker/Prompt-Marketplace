import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetUserProfile, useListPrompts, useGetUserLibraries, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Heart, Database, Calendar, Link as LinkIcon, User } from "lucide-react";
import { useState } from "react";

export default function Profile() {
  const { username } = useParams();
  const safeUsername = username || "me";
  const [activeTab, setActiveTab] = useState<"prompts" | "libraries">("prompts");

  const { data: profile, isLoading: profileLoading, isError } = useGetUserProfile(safeUsername, {
    query: {
      enabled: !!safeUsername,
      queryKey: getGetUserProfileQueryKey(safeUsername)
    }
  });

  const { data: promptsData, isLoading: promptsLoading } = useListPrompts({ username: safeUsername, limit: 12 }, {
    query: { enabled: activeTab === "prompts" }
  });

  const { data: librariesData, isLoading: libLoading } = useGetUserLibraries(safeUsername, {
    query: { enabled: activeTab === "libraries" }
  });

  if (profileLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-4 py-12">
          <Skeleton className="h-32 w-full rounded-lg mb-8" />
          <div className="flex gap-4 mb-8">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !profile) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-4 py-24 text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
          <p className="text-muted-foreground">The creator you are looking for does not exist.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary/20 border-b border-border">
        <div className="container mx-auto max-w-5xl px-4 md:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} className="w-24 h-24 rounded-full border-2 border-primary/20 shadow-[0_0_15px_rgba(0,200,5,0.15)]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-3xl font-bold border-2 border-border text-muted-foreground">
                {profile.username.substring(0,2).toUpperCase()}
              </div>
            )}
            
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{profile.displayName}</h1>
                <p className="text-primary font-mono text-sm mt-1">@{profile.username}</p>
              </div>
              
              {profile.bio && (
                <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground pt-2 font-mono">
                <span className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded">
                  <Terminal className="h-3.5 w-3.5" /> {profile.promptCount} Prompts
                </span>
                <span className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded">
                  <Heart className="h-3.5 w-3.5 text-primary" /> {profile.totalSaves} Saves received
                </span>
                <span className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded">
                  <Calendar className="h-3.5 w-3.5" /> Joined {new Date(profile.createdAt).getFullYear()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 md:px-8 py-8">
        <div className="flex items-center gap-6 border-b border-border mb-8">
          <button 
            onClick={() => setActiveTab("prompts")}
            className={`pb-3 text-sm font-medium transition-all ${activeTab === 'prompts' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="tab-prompts"
          >
            Prompts
          </button>
          <button 
            onClick={() => setActiveTab("libraries")}
            className={`pb-3 text-sm font-medium transition-all ${activeTab === 'libraries' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="tab-libraries"
          >
            Libraries
          </button>
        </div>

        {activeTab === "prompts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promptsLoading ? (
              Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)
            ) : promptsData?.prompts.length ? (
              promptsData.prompts.map(prompt => (
                <Link key={prompt.id} href={`/prompt/${prompt.id}`} className="group block h-full">
                  <div className="bg-card border border-border rounded-lg p-5 h-full flex flex-col hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-muted-foreground font-mono">{prompt.categoryName}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Heart className="h-3 w-3" /> {prompt.saveCount}
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{prompt.description}</p>
                    <div className="text-xs text-muted-foreground font-mono pt-4 border-t border-border/50">
                      {new Date(prompt.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No prompts published yet.
              </div>
            )}
          </div>
        )}

        {activeTab === "libraries" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {libLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
            ) : librariesData?.length ? (
              librariesData.map(lib => (
                <Link key={lib.id} href={`/library/${lib.id}`} className="group block h-full">
                  <div className="bg-card border border-border rounded-lg p-5 h-full flex flex-col hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Database className="h-5 w-5" />
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">{lib.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1 mb-4">{lib.description || "No description."}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono pt-4 border-t border-border/50">
                      <span>{lib.promptCount} Prompts</span>
                      <span>{new Date(lib.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No libraries created yet.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
