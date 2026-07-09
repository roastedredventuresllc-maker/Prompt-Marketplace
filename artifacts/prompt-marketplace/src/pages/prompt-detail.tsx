import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetPrompt, useToggleSavePrompt, useGetTrendingPrompts, getGetPromptQueryKey } from "@workspace/api-client-react";
import { Copy, Heart, Terminal, Share2, AlertTriangle, Eye, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function PromptDetail() {
  const { id } = useParams();
  const promptId = Number(id);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  
  // Assuming logged in user is 'me' for demo purposes, since auth isn't strict in instructions
  const currentUsername = "me"; 

  const { data: prompt, isLoading, isError } = useGetPrompt(promptId, {
    query: {
      enabled: !!promptId,
      queryKey: getGetPromptQueryKey(promptId)
    }
  });

  const { data: relatedPrompts } = useGetTrendingPrompts({ limit: 4 });

  const toggleSave = useToggleSavePrompt();

  const handleCopy = () => {
    if (!prompt?.content) return;
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSave = () => {
    if (!prompt) return;
    toggleSave.mutate({ id: promptId, data: { username: currentUsername } }, {
      onSuccess: (data) => {
        // Optimistic patch
        queryClient.setQueryData(getGetPromptQueryKey(promptId), (old: any) => 
          old ? { ...old, saveCount: data.saveCount } : old
        );
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-4 w-1/3 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2"><Skeleton className="h-[400px] w-full rounded-lg" /></div>
            <div><Skeleton className="h-[200px] w-full rounded-lg" /></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !prompt) {
    return (
      <Layout>
        <div className="container mx-auto max-w-7xl px-4 py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Prompt Not Found</h1>
          <p className="text-muted-foreground mb-6">This prompt may have been deleted or made private.</p>
          <Link href="/explore" className="text-primary hover:underline">Return to Explore</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary/30 border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 tracking-wide uppercase">
                  {prompt.categoryName}
                </span>
                <span className="text-muted-foreground text-sm flex items-center gap-1 font-mono">
                  <Eye className="h-4 w-4" /> {prompt.viewCount} views
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{prompt.title}</h1>
              {prompt.description && (
                <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
                  {prompt.description}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={handleToggleSave}
                disabled={toggleSave.isPending}
                className="flex items-center gap-2 bg-card border border-border hover:border-primary/50 px-4 py-2.5 rounded-md font-medium transition-all group"
                data-testid="btn-save-prompt"
              >
                <Heart className={`h-4 w-4 ${toggleSave.isPending ? 'animate-pulse' : 'group-hover:text-primary'}`} /> 
                <span className="tabular-nums">{prompt.saveCount}</span> Saves
              </button>
              <button className="flex items-center gap-2 bg-card border border-border hover:border-border/80 px-4 py-2.5 rounded-md font-medium transition-colors text-muted-foreground hover:text-foreground">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-muted px-4 py-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground font-mono">prompt_content.txt</span>
                </div>
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded"
                  data-testid="btn-copy-prompt"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy Prompt"}
                </button>
              </div>
              <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
                <pre className="font-mono text-sm leading-relaxed text-[#E5E5E5] whitespace-pre-wrap break-words">
                  {prompt.content}
                </pre>
              </div>
            </div>

            {prompt.tags.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded text-xs font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Creator</h3>
              <div className="flex items-center gap-4 mb-4">
                {prompt.authorAvatarUrl ? (
                  <img src={prompt.authorAvatarUrl} alt={prompt.authorUsername} className="w-12 h-12 rounded-full border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-base font-bold border border-border">
                    {prompt.authorUsername.substring(0,2).toUpperCase()}
                  </div>
                )}
                <div>
                  <Link href={`/profile/${prompt.authorUsername}`} className="font-semibold text-lg hover:text-primary transition-colors block">
                    {prompt.authorDisplayName}
                  </Link>
                  <span className="text-sm text-muted-foreground font-mono">@{prompt.authorUsername}</span>
                </div>
              </div>
              <Link href={`/profile/${prompt.authorUsername}`} className="block w-full text-center bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2 rounded text-sm font-medium transition-colors">
                View Profile
              </Link>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Similar Prompts</h3>
              <div className="flex flex-col gap-3">
                {relatedPrompts?.filter(p => p.id !== promptId).slice(0, 3).map(related => (
                  <Link key={related.id} href={`/prompt/${related.id}`} className="group block">
                    <div className="bg-card border border-border p-3 rounded-lg hover:border-primary/50 transition-colors">
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">{related.title}</h4>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {related.saveCount}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {related.viewCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </Layout>
  );
}
