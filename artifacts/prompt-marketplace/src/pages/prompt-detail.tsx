import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetPrompt, useToggleSavePrompt, useGetTrendingPrompts, getGetPromptQueryKey } from "@workspace/api-client-react";
import { Copy, Heart, Share2, AlertTriangle, Eye, Check, Building2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

function categoryAccentColor(catName?: string): string | null {
  const n = catName?.toLowerCase();
  if (n === "finance") return "var(--orange)";
  if (n === "law") return "var(--forest)";
  return null;
}

export default function PromptDetail() {
  const { id } = useParams();
  const promptId = Number(id);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const { data: prompt, isLoading, isError } = useGetPrompt(promptId, {
    query: { enabled: !!promptId, queryKey: getGetPromptQueryKey(promptId) },
  });

  const { data: relatedPrompts } = useGetTrendingPrompts({ limit: 4 });
  const toggleSave = useToggleSavePrompt();

  const accentColor = categoryAccentColor(prompt?.categoryName);

  const handleCopy = () => {
    if (!prompt?.content) return;
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleToggleSave = () => {
    if (!prompt) return;
    toggleSave.mutate({ id: promptId, data: { username: "me" } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetPromptQueryKey(promptId), (old: any) =>
          old ? { ...old, saveCount: data.saveCount } : old,
        );
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-10 w-2/3 mb-4 rounded-xl" />
          <Skeleton className="h-4 w-1/3 mb-10 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !prompt) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
          <AlertTriangle className="h-10 w-10 text-foreground/30" />
          <h1 className="text-xl font-semibold">Prompt not found</h1>
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">
            Back to explore
          </Link>
        </div>
      </Layout>
    );
  }

  const isFirm = prompt.authorOrgType === "firm";

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">
        <div className="container mx-auto max-w-5xl px-6 py-12">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] text-foreground/40 mb-8">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <span>/</span>
            <span
              className="font-medium"
              style={accentColor ? { color: accentColor } : {}}
            >
              {prompt.categoryName}
            </span>
            {prompt.subcategoryName && (
              <>
                <span>/</span>
                <span className="text-foreground/60">{prompt.subcategoryName}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">

                {/* Category badge */}
                <div className="flex items-center gap-2 mb-5">
                  <span
                    className="text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide"
                    style={accentColor
                      ? { background: `${accentColor}12`, color: accentColor }
                      : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)" }}
                  >
                    {prompt.subcategoryName ?? prompt.categoryName}
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight mb-3">{prompt.title}</h1>

                {prompt.description && (
                  <p className="text-[15px] text-foreground/60 leading-relaxed mb-6">{prompt.description}</p>
                )}

                {/* Prompt content box */}
                <div className="bg-[#F5F5F7] rounded-xl p-6 font-mono text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap border border-black/[0.04]">
                  {prompt.content}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-[14px] text-white transition-opacity hover:opacity-80"
                    style={{ background: accentColor ?? "#1d1d1f" }}
                    data-testid="copy-btn"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy prompt"}
                  </button>

                  <button
                    onClick={handleToggleSave}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[14px] bg-white border border-black/[0.08] hover:border-black/20 transition-all"
                    style={{ color: "var(--orange)" }}
                    data-testid="save-btn"
                  >
                    <Heart className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                    {prompt.saveCount}
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[14px] bg-white border border-black/[0.08] hover:border-black/20 transition-all text-foreground/60"
                    data-testid="share-btn"
                  >
                    <Share2 className="h-4 w-4" />
                    {shared ? "Copied link!" : "Share"}
                  </button>
                </div>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {prompt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[12px] px-3 py-1 rounded-full bg-black/[0.05] text-foreground/50 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">

              {/* Author card */}
              <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]"
                style={isFirm ? { borderLeft: `3px solid ${accentColor ?? "var(--orange)"}` } : {}}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">Creator</p>
                <Link href={`/profile/${prompt.authorUsername}`} className="group flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                    style={{ background: isFirm ? (accentColor ?? "var(--orange)") : "rgba(0,0,0,0.12)" }}
                  >
                    {isFirm
                      ? (prompt.authorOrgName?.[0] ?? prompt.authorDisplayName[0])
                      : prompt.authorDisplayName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-[15px] text-foreground group-hover:underline underline-offset-2">
                        {isFirm ? (prompt.authorOrgName ?? prompt.authorDisplayName) : prompt.authorDisplayName}
                      </p>
                      {isFirm && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white"
                          style={{ background: accentColor ?? "var(--orange)" }}
                        >
                          FIRM
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-foreground/40">@{prompt.authorUsername}</p>
                  </div>
                </Link>
                <Link
                  href={`/profile/${prompt.authorUsername}`}
                  className="block w-full text-center py-2 rounded-xl text-[13px] font-medium border border-black/[0.08] text-foreground/60 hover:border-black/20 hover:text-foreground transition-all"
                >
                  View profile
                </Link>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">Stats</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground/50 text-[14px]">
                      <Heart className="h-4 w-4" style={{ color: "var(--orange)" }} />
                      Saves
                    </div>
                    <span className="font-semibold text-[14px]" style={{ color: "var(--orange)" }}>
                      {prompt.saveCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground/50 text-[14px]">
                      <Eye className="h-4 w-4" />
                      Views
                    </div>
                    <span className="font-semibold text-[14px]">{prompt.viewCount}</span>
                  </div>
                </div>
              </div>

              {/* Related */}
              {relatedPrompts && relatedPrompts.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">Trending</p>
                  <div className="space-y-3">
                    {relatedPrompts.slice(0, 3).map((p) => (
                      <Link key={p.id} href={`/prompt/${p.id}`} className="block group">
                        <p className="text-[13px] font-medium text-foreground/70 group-hover:text-foreground transition-colors line-clamp-2 leading-snug">
                          {p.title}
                        </p>
                        <span className="text-[11px]" style={{ color: "var(--orange)" }}>
                          {p.saveCount} saves
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
