import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetUserProfile,
  useListPrompts,
  useGetUserLibraries,
  getGetUserProfileQueryKey,
  getListPromptsQueryKey,
  getGetUserLibrariesQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Calendar, User, BookOpen, Building2, Copy, Check } from "lucide-react";
import { useState } from "react";

function categoryAccentColor(catName?: string | null): string | null {
  const n = catName?.toLowerCase();
  if (n === "finance") return "var(--orange)";
  if (n === "law")     return "var(--forest)";
  return null;
}

export default function Profile() {
  const { username } = useParams();
  const safeUsername = username || "me";
  const [activeTab, setActiveTab] = useState<"prompts" | "libraries">("prompts");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: profile, isLoading: profileLoading, isError } = useGetUserProfile(safeUsername, {
    query: { enabled: !!safeUsername, queryKey: getGetUserProfileQueryKey(safeUsername) },
  });

  const listPromptsParams = { username: safeUsername, limit: 24 };
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts(
    listPromptsParams,
    { query: { enabled: activeTab === "prompts", queryKey: getListPromptsQueryKey(listPromptsParams) } }
  );

  const { data: librariesData, isLoading: libLoading } = useGetUserLibraries(safeUsername, {
    query: { enabled: activeTab === "libraries", queryKey: getGetUserLibrariesQueryKey(safeUsername) },
  });

  function handleCopy(e: React.MouseEvent, content: string, id: number) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (profileLoading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="bg-white border-b border-black/[0.05] px-6 py-14">
            <div className="max-w-5xl mx-auto flex items-center gap-6">
              <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-48 mb-2 rounded-lg" />
                <Skeleton className="h-4 w-32 mb-4 rounded-lg" />
                <Skeleton className="h-4 w-64 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !profile) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
          <User className="h-10 w-10 text-foreground/30" />
          <h1 className="text-xl font-semibold">Creator not found</h1>
          <p className="text-[14px] text-foreground/50">This profile does not exist or has been removed.</p>
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">
            Back to explore
          </Link>
        </div>
      </Layout>
    );
  }

  const isFirm = (profile as any).orgType === "firm";
  const orgName = (profile as any).orgName as string | null;
  const displayName = orgName ?? profile.displayName;

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* ── Profile header ─────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.05] px-6 py-14">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">

              {/* Avatar */}
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shrink-0"
                  style={{ background: isFirm ? "var(--orange)" : "rgba(0,0,0,0.10)", color: isFirm ? undefined : "rgba(0,0,0,0.3)" }}
                >
                  {displayName.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                {/* Name + firm badge */}
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-1">
                  <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                  {isFirm && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-bold text-white"
                      style={{ background: "var(--orange)" }}
                    >
                      FIRM
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-foreground/40 mb-3">@{profile.username}</p>

                {profile.bio && (
                  <p className="text-[15px] text-foreground/60 leading-relaxed max-w-2xl mb-5">{profile.bio}</p>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-[13px]">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] text-foreground/60">
                    <BookOpen className="h-3.5 w-3.5" />
                    {profile.promptCount} prompts
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7]" style={{ color: "var(--orange)" }}>
                    <Heart className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    {profile.totalSaves} saves
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] text-foreground/50">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {new Date(profile.createdAt).getFullYear()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.06] px-6">
          <div className="max-w-5xl mx-auto flex items-center gap-6">
            {(["prompts", "libraries"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="py-3.5 text-[14px] font-medium capitalize transition-all border-b-2"
                style={activeTab === tab
                  ? { borderColor: "var(--orange)", color: "var(--orange)" }
                  : { borderColor: "transparent", color: "rgba(0,0,0,0.45)" }}
                data-testid={`tab-${tab}`}
              >
                {tab === "prompts" ? "Prompts" : "Collections"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Prompts tab */}
          {activeTab === "prompts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promptsLoading
                ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
                : promptsData?.prompts.length
                ? promptsData.prompts.map(prompt => {
                    const accent = categoryAccentColor(prompt.categoryName);
                    return (
                      <Link
                        key={prompt.id}
                        href={`/prompt/${prompt.id}`}
                        className="group block"
                        data-testid={`profile-prompt-${prompt.id}`}
                      >
                        <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
                              style={accent
                                ? { background: `${accent}12`, color: accent }
                                : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)" }}
                            >
                              {prompt.subcategoryName ?? prompt.categoryName}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: "var(--orange)" }}>
                              <Heart className="h-3 w-3" fill={prompt.saveCount > 0 ? "currentColor" : "none"} strokeWidth={prompt.saveCount > 0 ? 0 : 1.5} />
                              {prompt.saveCount}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">
                              {prompt.title}
                            </h3>
                            <p className="text-[13px] text-foreground/50 line-clamp-2 leading-relaxed">
                              {prompt.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
                            <span className="text-[12px] text-foreground/35">
                              {new Date(prompt.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </span>
                            <button
                              onClick={e => handleCopy(e, prompt.content, prompt.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/50 font-medium"
                            >
                              {copiedId === prompt.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copiedId === prompt.id ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                : (
                  <div className="col-span-full py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="h-5 w-5 text-foreground/30" />
                    </div>
                    <h3 className="font-semibold mb-1">No prompts yet</h3>
                    <p className="text-[14px] text-foreground/50">This creator has not published any prompts.</p>
                  </div>
                )}
            </div>
          )}

          {/* Libraries tab */}
          {activeTab === "libraries" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libLoading
                ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)
                : librariesData?.length
                ? librariesData.map(lib => (
                  <Link
                    key={lib.id}
                    href={`/library/${lib.id}`}
                    className="group block"
                    data-testid={`library-card-${lib.id}`}
                  >
                    <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 text-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[15px] group-hover:text-foreground/70 transition-colors truncate">{lib.name}</h3>
                          <p className="text-[12px] text-foreground/40">{lib.promptCount} prompts</p>
                        </div>
                      </div>
                      {lib.description && (
                        <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-2">{lib.description}</p>
                      )}
                      <div className="pt-3 border-t border-black/[0.04] text-[12px] text-foreground/35">
                        Updated {new Date(lib.updatedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </Link>
                ))
                : (
                  <div className="col-span-full py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="h-5 w-5 text-foreground/30" />
                    </div>
                    <h3 className="font-semibold mb-1">No collections yet</h3>
                    <p className="text-[14px] text-foreground/50">This creator has not curated any collections.</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
