import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetLibrary, getGetLibraryQueryKey } from "@workspace/api-client-react";
import { Heart, AlertTriangle, ArrowLeft, BookOpen, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

function categoryAccentColor(catName?: string | null): string | null {
  const n = catName?.toLowerCase();
  if (n === "finance") return "var(--orange)";
  if (n === "law")     return "var(--forest)";
  return null;
}

export default function LibraryDetail() {
  const { id } = useParams();
  const libraryId = Number(id);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: library, isLoading, isError } = useGetLibrary(libraryId, {
    query: { enabled: !!libraryId, queryKey: getGetLibraryQueryKey(libraryId) },
  });

  function handleCopy(e: React.MouseEvent, content: string, promptId: number) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(promptId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="bg-white border-b border-black/[0.05] px-6 py-12">
            <div className="max-w-5xl mx-auto">
              <Skeleton className="h-4 w-24 mb-6 rounded-lg" />
              <Skeleton className="h-9 w-72 mb-3 rounded-xl" />
              <Skeleton className="h-4 w-48 rounded-lg" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !library) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
          <AlertTriangle className="h-10 w-10 text-foreground/30" />
          <h1 className="text-xl font-semibold">Collection not found</h1>
          <p className="text-[14px] text-foreground/50">This collection may have been removed or made private.</p>
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">Back to explore</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* Header */}
        <div className="bg-white border-b border-black/[0.05] px-6 py-14">
          <div className="max-w-5xl mx-auto">
            <Link
              href={`/profile/${library.authorUsername}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors mb-7"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to {library.authorUsername}
            </Link>

            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-foreground/40" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/35">
                    Curated collection
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">{library.name}</h1>
                {library.description && (
                  <p className="text-[15px] text-foreground/60 leading-relaxed max-w-2xl mb-4">{library.description}</p>
                )}
                <div className="flex items-center gap-4 text-[13px] text-foreground/40">
                  <span>{library.prompts?.length ?? 0} prompts</span>
                  <span>By <Link href={`/profile/${library.authorUsername}`} className="hover:text-foreground transition-colors">@{library.authorUsername}</Link></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prompts grid */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {library.prompts && library.prompts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {library.prompts.map((prompt: any) => {
                const accent = categoryAccentColor(prompt.categoryName);
                return (
                  <Link
                    key={prompt.id}
                    href={`/prompt/${prompt.id}`}
                    className="group block"
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
                        <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-2">
                          {prompt.description ?? prompt.content?.slice(0, 80) + "…"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
                        <span className="text-[12px] text-foreground/40 truncate">
                          {prompt.authorDisplayName}
                        </span>
                        <button
                          onClick={e => handleCopy(e, prompt.content, prompt.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/50 font-medium"
                        >
                          {copiedId === prompt.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === prompt.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-5 w-5 text-foreground/30" />
              </div>
              <h3 className="font-semibold mb-1">This collection is empty</h3>
              <p className="text-[14px] text-foreground/50">No prompts have been added yet.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
