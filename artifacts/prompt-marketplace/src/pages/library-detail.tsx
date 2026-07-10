import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetLibrary, getGetLibraryQueryKey } from "@workspace/api-client-react";
import { Heart, AlertTriangle, ArrowLeft, BookOpen, Copy, Check, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

type PromptItem = {
  id: number;
  title: string;
  content: string;
  description?: string | null;
  categoryName: string;
  subcategoryName?: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorOrgType?: string | null;
  authorOrgName?: string | null;
  saveCount: number;
};

function accentForCategory(catName?: string | null) {
  return { color: "var(--orange)", subtle: "var(--orange-subtle)", label: catName ?? "" };
}

/* Determine collection's dominant accent from its first prompt */
function collectionAccent(prompts: PromptItem[]) {
  const first = prompts[0];
  return first ? accentForCategory(first.categoryName) : null;
}

function PromptCard({ prompt, accent, onCopy, copied }: {
  prompt: PromptItem;
  accent: ReturnType<typeof accentForCategory>;
  onCopy: (e: React.MouseEvent, content: string, id: number) => void;
  copied: boolean;
}) {
  const isFirm = prompt.authorOrgType === "firm";
  const label = prompt.subcategoryName ?? prompt.categoryName;

  return (
    <Link href={`/prompt/${prompt.id}`} className="group block" data-testid={`library-prompt-${prompt.id}`}>
      <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">
        {/* Badge + saves */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={accent
              ? { background: accent.subtle, color: accent.color }
              : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)" }}
          >
            {label}
          </span>
          <span className="flex items-center gap-1 text-[11px] tabular-nums font-medium shrink-0" style={{ color: "var(--orange)" }}>
            <Heart className="h-3 w-3" fill={prompt.saveCount > 0 ? "currentColor" : "none"} strokeWidth={prompt.saveCount > 0 ? 0 : 1.5} />
            {prompt.saveCount}
          </span>
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
          <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-2">
            {prompt.description ?? prompt.content.slice(0, 80) + "…"}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
          <div className="flex items-center gap-1.5 min-w-0">
            {isFirm ? (
              <>
                <Building2 className="h-3 w-3 shrink-0" style={{ color: accent?.color ?? "var(--orange)" }} />
                <span className="text-[12px] font-semibold truncate" style={{ color: accent?.color ?? "var(--orange)" }}>
                  {prompt.authorOrgName ?? prompt.authorDisplayName}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-foreground/40 truncate">{prompt.authorDisplayName}</span>
            )}
          </div>
          <button
            onClick={e => onCopy(e, prompt.content, prompt.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/50 font-medium"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function LibraryDetail() {
  const { id } = useParams();
  const libraryId = Number(id);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: library, isLoading, isError } = useGetLibrary(libraryId, {
    query: { enabled: !!libraryId, queryKey: getGetLibraryQueryKey(libraryId) },
  });

  function handleCopy(e: React.MouseEvent, content: string, promptId: number) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(promptId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="bg-white border-b border-black/[0.05] px-6 py-14">
            <div className="max-w-5xl mx-auto">
              <Skeleton className="h-4 w-24 mb-6 rounded-lg" />
              <Skeleton className="h-8 w-80 mb-3 rounded-xl" />
              <Skeleton className="h-5 w-full max-w-xl mb-2 rounded-lg" />
              <Skeleton className="h-5 w-3/4 max-w-lg rounded-lg" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
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
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">
            Back to explore
          </Link>
        </div>
      </Layout>
    );
  }

  const prompts: PromptItem[] = (library.prompts ?? []) as PromptItem[];
  const accent = collectionAccent(prompts);

  // Group prompts by subcategory for organised display
  const groups = prompts.reduce<Record<string, PromptItem[]>>((acc, p) => {
    const key = p.subcategoryName ?? p.categoryName ?? "Other";
    acc[key] = acc[key] ? [...acc[key], p] : [p];
    return acc;
  }, {});
  const hasMultipleGroups = Object.keys(groups).length > 1;

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* ── Hero ───────────────────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.05]" style={accent ? { borderTop: `4px solid ${accent.color}` } : {}}>
          <div className="max-w-5xl mx-auto px-6 py-14">
            {/* Back link */}
            <Link
              href={`/profile/${library.authorUsername}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {library.authorDisplayName}
            </Link>

            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Collection icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                style={accent ? { background: accent.subtle } : { background: "#F5F5F7" }}
              >
                <BookOpen className="h-7 w-7" style={{ color: accent?.color ?? "rgba(0,0,0,0.35)" }} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Eyebrow */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: accent?.color ?? "rgba(0,0,0,0.35)" }}
                  >
                    Curated collection
                  </span>
                  {accent && (
                    <span className="text-[11px] text-foreground/30">·</span>
                  )}
                  {accent && (
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground/35">
                      {accent.label}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-3">
                  {library.name}
                </h1>

                {/* Description */}
                {library.description && (
                  <p className="text-[16px] text-foreground/60 leading-relaxed max-w-2xl mb-5">
                    {library.description}
                  </p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4 text-[13px]">
                  <Link
                    href={`/profile/${library.authorUsername}`}
                    className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground transition-colors"
                  >
                    <span>By</span>
                    <span className="font-medium">{library.authorDisplayName}</span>
                  </Link>
                  <span className="text-foreground/25">·</span>
                  <span
                    className="font-semibold px-2.5 py-1 rounded-full text-[12px]"
                    style={accent
                      ? { background: accent.subtle, color: accent.color }
                      : { background: "#F5F5F7", color: "rgba(0,0,0,0.45)" }}
                  >
                    {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Prompts ────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          {prompts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-5 w-5 text-foreground/30" />
              </div>
              <h3 className="font-semibold mb-1">This collection is empty</h3>
              <p className="text-[14px] text-foreground/50">No prompts have been added yet.</p>
            </div>
          ) : hasMultipleGroups ? (
            /* Grouped by subcategory */
            <div className="space-y-10">
              {Object.entries(groups).map(([groupName, groupPrompts]) => (
                <div key={groupName}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={accent
                        ? { background: accent.subtle, color: accent.color }
                        : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)" }}
                    >
                      {groupName}
                    </span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupPrompts.map(p => (
                      <PromptCard
                        key={p.id}
                        prompt={p}
                        accent={accent}
                        onCopy={handleCopy}
                        copied={copiedId === p.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Single category — flat grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prompts.map(p => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  accent={accent}
                  onCopy={handleCopy}
                  copied={copiedId === p.id}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
