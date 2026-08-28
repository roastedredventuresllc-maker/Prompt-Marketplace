import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetPrompt,
  useToggleSavePrompt,
  useListPrompts,
  getGetPromptQueryKey,
  getListPromptsQueryKey,
} from "@workspace/api-client-react";
import {
  Copy, Heart, Share2, AlertTriangle, Eye, Check, Pencil,
  Trash2, Building2, ShoppingCart,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PaywallGate } from "@/components/paywall-gate";
import { AddToLibraryMenu } from "@/components/add-to-library-menu";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useMyUsername() {
  const { isSignedIn } = useAuth();
  return useQuery<string | null>({
    queryKey: ["users", "me", "username"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/users/me`, { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()).username ?? null;
    },
    enabled: !!isSignedIn,
    retry: false,
  });
}

/* ── Star helpers ────────────────────────────────────────────── */
function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={"flex items-center gap-0.5 " + sz}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= Math.round(rating) ? "var(--orange)" : "rgba(0,0,0,0.15)" }}>★</span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="text-2xl leading-none transition-transform hover:scale-110"
          style={{ color: s <= (hovered || value) ? "var(--orange)" : "rgba(0,0,0,0.15)" }}
        >★</button>
      ))}
    </span>
  );
}

type RatingEntry = { id: number; rating: number; review: string | null; createdAt: string; isOwn: boolean };
type RatingsData = { ratings: RatingEntry[]; avg: number; count: number; userRating: number | null };

function useRatings(promptId: number) {
  return useQuery<RatingsData>({
    queryKey: ["ratings", promptId],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/prompts/${promptId}/ratings`, { credentials: "include" });
      if (!r.ok) return { ratings: [], avg: 0, count: 0, userRating: null };
      return r.json();
    },
    enabled: !!promptId,
  });
}

/* ── Ratings sidebar card ────────────────────────────────────── */
function RatingsCard({
  promptId,
  isAuthor,
  isSignedIn,
}: {
  promptId: number;
  isAuthor: boolean;
  isSignedIn: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useRatings(promptId);
  const [draftRating, setDraftRating] = useState(0);
  const [draftReview, setDraftReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill if user already rated
  useEffect(() => {
    if (data?.userRating) setDraftRating(data.userRating);
  }, [data?.userRating]);

  async function handleSubmit() {
    if (!draftRating) return;
    setSubmitting(true);
    try {
      await fetch(`${basePath}/api/prompts/${promptId}/rate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: draftRating, review: draftReview || undefined }),
      });
      await queryClient.invalidateQueries({ queryKey: ["ratings", promptId] });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <Skeleton className="h-36 w-full rounded-2xl" />;

  const avg = data?.avg ?? 0;
  const count = data?.count ?? 0;
  const alreadyRated = (data?.userRating ?? 0) > 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">
      <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">Ratings</p>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-5">
        {count > 0 ? (
          <>
            <span className="text-3xl font-bold tracking-tight">{avg.toFixed(1)}</span>
            <div>
              <StarDisplay rating={avg} size="sm" />
              <p className="text-[12px] text-foreground/40 mt-0.5">{count} {count === 1 ? "rating" : "ratings"}</p>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-foreground/40">No ratings yet</p>
        )}
      </div>

      {/* Rating form */}
      {!isSignedIn && (
        <p className="text-[12px] text-foreground/40">
          <Link href="/sign-in" style={{ color: "var(--orange)" }}>Sign in</Link> to leave a rating.
        </p>
      )}

      {isSignedIn && isAuthor && (
        <p className="text-[12px] text-foreground/40">You can't rate your own prompt.</p>
      )}

      {isSignedIn && !isAuthor && (
        <div className="space-y-3">
          <div>
            <p className="text-[12px] text-foreground/50 mb-2">
              {alreadyRated ? "Update your rating" : "Rate this prompt"}
            </p>
            <StarPicker value={draftRating} onChange={setDraftRating} />
          </div>
          <textarea
            value={draftReview}
            onChange={e => setDraftReview(e.target.value)}
            placeholder="Optional review…"
            rows={2}
            className="w-full text-[13px] bg-[#f5f5f7] rounded-xl px-3 py-2 resize-none border-0 focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "var(--orange)30" } as any}
          />
          <button
            onClick={handleSubmit}
            disabled={!draftRating || submitting}
            className="w-full py-2 rounded-xl text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--orange)" }}
          >
            {submitting ? "Saving…" : submitted ? "✓ Saved!" : alreadyRated ? "Update rating" : "Submit rating"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Reviews list ────────────────────────────────────────────── */
function ReviewsList({ promptId }: { promptId: number }) {
  const { data } = useRatings(promptId);
  const reviews = (data?.ratings ?? []).filter(r => r.review);

  if (!data || data.count === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">
      <h3 className="text-[15px] font-semibold mb-4">
        Reviews <span className="text-foreground/30 font-normal text-[13px]">({data.count})</span>
      </h3>

      {reviews.length === 0 ? (
        <p className="text-[13px] text-foreground/40">No written reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.slice(0, 5).map(r => (
            <div key={r.id} className="pb-4 border-b border-black/[0.05] last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1.5">
                <StarDisplay rating={r.rating} size="sm" />
                <span className="text-[11px] text-foreground/30">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {r.isOwn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--orange-subtle)] text-[var(--orange)] font-medium">You</span>}
              </div>
              <p className="text-[13px] text-foreground/70 leading-relaxed">{r.review}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compact horizontal scroll card ─────────────────────────────── */
function RelatedCard({ prompt }: { prompt: any }) {
  const isFirm = prompt.authorOrgType === "firm";
  const authorName = isFirm ? (prompt.authorOrgName ?? prompt.authorDisplayName) : prompt.authorDisplayName;
  const price = prompt.priceCents;

  return (
    <Link
      href={`/prompt/${prompt.id}`}
      className="group shrink-0 w-[270px] block bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05] flex flex-col gap-3"
      data-testid={`related-prompt-${prompt.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--orange-subtle)", color: "var(--orange)" }}>
          {prompt.subcategoryName ?? prompt.categoryName}
        </span>
        <span className="flex items-center gap-0.5 text-[11px] tabular-nums shrink-0 font-medium" style={{ color: "var(--orange)" }}>
          <Heart className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
          {prompt.saveCount}
        </span>
      </div>

      <div className="flex-1">
        <h4 className="font-semibold text-[14px] leading-snug text-foreground group-hover:text-foreground/70 transition-colors line-clamp-2 mb-1.5">
          {prompt.title}
        </h4>
        {prompt.description && (
          <p className="text-[12px] text-foreground/50 line-clamp-2 leading-relaxed">
            {prompt.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-black/[0.05]">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
            style={isFirm ? { background: "var(--orange-subtle)", color: "var(--orange)" } : { background: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.4)" }}>
            {isFirm ? <Building2 className="h-2 w-2" /> : (authorName ?? "?")[0]}
          </div>
          <span className="text-[11px] text-foreground/45 truncate font-medium">{authorName}</span>
        </div>
        {price ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--orange-subtle)", color: "var(--orange)" }}>
            ${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-foreground/30">Free</span>
        )}
      </div>
    </Link>
  );
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function PromptDetail() {
  const { id } = useParams();
  const promptId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: myUsername } = useMyUsername();
  const { isSignedIn } = useAuth();

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [promptId]);

  const { data: prompt, isLoading, isError } = useGetPrompt(promptId, {
    query: { enabled: !!promptId, queryKey: getGetPromptQueryKey(promptId) },
  });

  const { data: relatedData } = useListPrompts(
    { categoryId: prompt?.categoryId, limit: 10 } as any,
    { query: { enabled: !!prompt?.categoryId, queryKey: getListPromptsQueryKey({ categoryId: prompt?.categoryId, limit: 10 } as any) } }
  );
  const relatedPrompts = (relatedData?.prompts ?? []).filter(p => p.id !== promptId).slice(0, 8);

  const toggleSave = useToggleSavePrompt();
  const accentColor = "var(--orange)";

  const handleCopy = () => {
    if (!prompt?.content || prompt.isGated !== false) return;
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
      onSuccess: data => {
        queryClient.setQueryData(getGetPromptQueryKey(promptId), (old: any) =>
          old ? { ...old, saveCount: data.saveCount } : old
        );
      },
    });
  };

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); return; }
    setDeleting(true);
    await fetch(`${basePath}/api/prompts/${promptId}`, { method: "DELETE", credentials: "include" });
    setLocation(`/profile/${prompt?.authorUsername}`);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-10 w-2/3 mb-4 rounded-xl" />
          <Skeleton className="h-4 w-1/3 mb-10 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2"><Skeleton className="h-[400px] w-full rounded-2xl" /></div>
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
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">Back to explore</Link>
        </div>
      </Layout>
    );
  }

  const isFirm = prompt.authorOrgType === "firm";
  const isAuthor = !!myUsername && myUsername === prompt.authorUsername;
  const authorName = isFirm ? (prompt.authorOrgName ?? prompt.authorDisplayName) : prompt.authorDisplayName;
  const avgRating = (prompt as any).avgRating ?? 0;
  const ratingCount = (prompt as any).ratingCount ?? 0;

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">
        <div className="container mx-auto max-w-5xl px-6 py-12">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] text-foreground/40 mb-8">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <span>/</span>
            <span className="font-medium" style={{ color: accentColor }}>{prompt.categoryName}</span>
            {prompt.subcategoryName && (
              <><span>/</span><span className="text-foreground/60">{prompt.subcategoryName}</span></>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* ── Main content ── */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]">

                <div className="flex items-center gap-2 mb-5">
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide" style={{ background: `${accentColor}12`, color: accentColor }}>
                    {prompt.subcategoryName ?? prompt.categoryName}
                  </span>
                  {ratingCount > 0 && (
                    <span className="flex items-center gap-1 text-[12px] text-foreground/40">
                      <StarDisplay rating={avgRating} />
                      <span className="tabular-nums">{avgRating.toFixed(1)}</span>
                      <span>({ratingCount})</span>
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="text-2xl font-bold tracking-tight">{prompt.title}</h1>
                  {isAuthor && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/prompt/${promptId}/edit`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#f5f5f7] text-foreground/60 hover:bg-[#eaeaea] hover:text-foreground transition-colors">
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                          confirmDelete
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-[#f5f5f7] text-foreground/50 hover:bg-red-50 hover:text-red-500"
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                        {deleting ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>

                {prompt.description && (
                  <p className="text-[15px] text-foreground/60 leading-relaxed mb-6">{prompt.description}</p>
                )}

                <PaywallGate
                  promptId={promptId}
                  accentColor={accentColor}
                  onAccessGranted={() => queryClient.invalidateQueries({ queryKey: getGetPromptQueryKey(promptId) })}
                >
                  <div className="bg-[#F5F5F7] rounded-xl p-6 font-mono text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap border border-black/[0.04]">
                    {prompt.content}
                  </div>
                  <div className="flex items-center gap-3 mt-6">
                    {prompt.isGated === false && (
                    <button onClick={handleCopy}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-[14px] text-white transition-opacity hover:opacity-80"
                      style={{ background: accentColor }} data-testid="copy-btn">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied!" : "Copy prompt"}
                    </button>
                    )}
                  </div>
                </PaywallGate>

                {/* Always-visible actions */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <button onClick={handleToggleSave}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[14px] bg-white border border-black/[0.08] hover:border-black/20 transition-all"
                    style={{ color: "var(--orange)" }} data-testid="save-btn">
                    <Heart className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                    {prompt.saveCount}
                  </button>
                  <button onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[14px] bg-white border border-black/[0.08] hover:border-black/20 transition-all text-foreground/60"
                    data-testid="share-btn">
                    <Share2 className="h-4 w-4" />
                    {shared ? "Copied link!" : "Share"}
                  </button>

                  <div className="relative" style={{ zIndex: 10 }}>
                    <AddToLibraryMenu promptId={promptId} variant="pill" />
                  </div>
                </div>

                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {prompt.tags.map(tag => (
                      <span key={tag} className="text-[12px] px-3 py-1 rounded-full bg-black/[0.05] text-foreground/50 font-medium">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviews list */}
              <ReviewsList promptId={promptId} />
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">

              {/* Author card */}
              <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05]"
                style={isFirm ? { borderLeft: `3px solid ${accentColor}` } : {}}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">Creator</p>
                <Link href={`/profile/${prompt.authorUsername}`} className="group flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                    style={{ background: isFirm ? accentColor : "rgba(0,0,0,0.12)" }}>
                    {isFirm ? (prompt.authorOrgName?.[0] ?? prompt.authorDisplayName[0]) : prompt.authorDisplayName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-[15px] text-foreground group-hover:underline underline-offset-2">{authorName}</p>
                      {isFirm && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white" style={{ background: accentColor }}>FIRM</span>}
                    </div>
                    <p className="text-[12px] text-foreground/40">@{prompt.authorUsername}</p>
                  </div>
                </Link>
                <Link href={`/profile/${prompt.authorUsername}`}
                  className="block w-full text-center py-2 rounded-xl text-[13px] font-medium border border-black/[0.08] text-foreground/60 hover:border-black/20 hover:text-foreground transition-all">
                  View profile
                </Link>
              </div>

              {/* Ratings card */}
              <RatingsCard
                promptId={promptId}
                isAuthor={isAuthor}
                isSignedIn={!!isSignedIn}
              />

            </div>
          </div>

          {/* ── Related prompts — horizontal scroll ── */}
          {relatedPrompts.length > 0 && (
            <div className="mt-14 pt-10 border-t border-black/[0.06]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-bold tracking-tight">
                  More in <span style={{ color: "var(--orange)" }}>{prompt.categoryName}</span>
                </h2>
                <Link
                  href={`/explore?categoryId=${prompt.categoryId}`}
                  className="text-[13px] text-foreground/40 hover:text-foreground transition-colors"
                >
                  Browse all →
                </Link>
              </div>
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-6 px-6">
                <div className="flex gap-4 pb-2" style={{ width: "max-content" }}>
                  {relatedPrompts.map(p => <RelatedCard key={p.id} prompt={p} />)}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
