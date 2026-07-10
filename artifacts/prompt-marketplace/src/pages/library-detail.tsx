import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetLibrary, getGetLibraryQueryKey } from "@workspace/api-client-react";
import {
  AlertTriangle, ArrowLeft, BookOpen, Copy, Check,
  Building2, Pencil, ShoppingBag, CheckCircle, Loader2, Lock, Unlock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser, SignInButton } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── helpers ─────────────────────────────────────────────────────────── */

function useMyUsername() {
  const { isSignedIn } = useUser();
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

type LibraryAccess = { hasAccess: boolean; reason: string; priceCents: number };

function useLibraryAccess(libraryId: number, enabled: boolean) {
  return useQuery<LibraryAccess>({
    queryKey: ["library-access", libraryId],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/access/library/${libraryId}`, { credentials: "include" });
      if (!res.ok) return { hasAccess: false, reason: "error", priceCents: 10000 };
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
function centsToStr(c: number) { return (c / 100).toFixed(c % 100 === 0 ? 0 : 2); }
function strToCents(s: string) {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/* ── types ───────────────────────────────────────────────────────────── */

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

function collectionAccent(_prompts: PromptItem[]) {
  return { color: "var(--orange)", subtle: "var(--orange-subtle)", label: _prompts[0]?.categoryName ?? "" };
}

/* ── PromptCard ──────────────────────────────────────────────────────── */

function PromptCard({
  prompt, accent, onCopy, copied, locked,
}: {
  prompt: PromptItem;
  accent: ReturnType<typeof collectionAccent>;
  onCopy: (e: React.MouseEvent, content: string, id: number) => void;
  copied: boolean;
  locked: boolean;
}) {
  const isFirm = prompt.authorOrgType === "firm";
  const label = prompt.subcategoryName ?? prompt.categoryName;

  return (
    <Link href={`/prompt/${prompt.id}`} className="group block" data-testid={`library-prompt-${prompt.id}`}>
      <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.09)] transition-all duration-300 border border-black/[0.05]">

        {/* Top row: category badge + saves */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: accent.subtle, color: accent.color }}
          >
            {label}
          </span>
          {locked ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-foreground/25" />
          ) : (
            <Unlock className="h-3.5 w-3.5 shrink-0 text-foreground/20" />
          )}
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
          <p className="text-[13px] text-foreground/50 leading-relaxed line-clamp-3">
            {prompt.description ?? prompt.content.slice(0, 100) + "…"}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.05]">
          {/* Author */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={isFirm
                ? { background: accent.subtle, color: accent.color }
                : { background: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.45)" }}
            >
              {isFirm ? <Building2 className="h-2.5 w-2.5" /> : (prompt.authorDisplayName[0] ?? "?")}
            </div>
            <span className="text-[12px] text-foreground/45 truncate">
              {isFirm ? (prompt.authorOrgName ?? prompt.authorDisplayName) : prompt.authorDisplayName}
            </span>
          </div>

          {/* Copy — always visible, dims when not hovering */}
          {!locked && (
            <button
              onClick={e => onCopy(e, prompt.content, prompt.id)}
              className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/40 hover:text-foreground/70 font-medium transition-all"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {locked && (
            <span className="text-[11px] text-foreground/30 px-2 py-1">Locked</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── CollectionBuyBar ────────────────────────────────────────────────── */

function CollectionBuyBar({
  priceCents,
  promptCount,
  authorName,
  onBuy,
  buying,
  isSignedIn,
}: {
  priceCents: number;
  promptCount: number;
  authorName: string;
  onBuy: () => void;
  buying: boolean;
  isSignedIn: boolean;
}) {
  return (
    <div
      className="mt-10 rounded-3xl border border-black/[0.05] shadow-[0_6px_32px_rgba(0,0,0,0.09)] overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1d1d1f 0%, #2d2d2f 100%)" }}
    >
      <div className="px-8 py-8 md:py-10 flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--orange)" }}>
          <BookOpen className="h-7 w-7 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-[20px] leading-tight mb-1">
            Unlock all {promptCount} prompts
          </h3>
          <p className="text-white/50 text-[14px]">
            Full access to every prompt by {authorName} — yours forever, one time.
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-white/40 text-[12px]">
              <CheckCircle className="h-3.5 w-3.5" style={{ color: "var(--orange)" }} />
              One-time purchase
            </div>
            <div className="flex items-center gap-1.5 text-white/40 text-[12px]">
              <CheckCircle className="h-3.5 w-3.5" style={{ color: "var(--orange)" }} />
              Secured by Whop
            </div>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
          <div className="text-[36px] font-black text-white leading-none">{fmt(priceCents)}</div>
          {isSignedIn ? (
            <button
              onClick={onBuy}
              disabled={buying}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-[14px] text-white transition-opacity hover:opacity-80 disabled:opacity-50 whitespace-nowrap"
              style={{ background: "var(--orange)" }}
            >
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              {buying ? "Redirecting…" : "Buy collection"}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-[14px] text-white transition-opacity hover:opacity-80 whitespace-nowrap" style={{ background: "var(--orange)" }}>
                <ShoppingBag className="h-4 w-4" />
                Buy collection
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */

export default function LibraryDetail() {
  const { id } = useParams();
  const libraryId = Number(id);
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useUser();

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const { data: myUsername } = useMyUsername();

  const { data: library, isLoading, isError } = useGetLibrary(libraryId, {
    query: { enabled: !!libraryId, queryKey: getGetLibraryQueryKey(libraryId) },
  });

  const { data: accessData, isLoading: accessLoading } = useLibraryAccess(
    libraryId,
    !!libraryId && isLoaded,
  );

  const isOwner = !!myUsername && myUsername === library?.authorUsername;
  const hasAccess = isOwner || (accessData?.hasAccess ?? false);
  const priceCents = (library as any)?.priceCents ?? accessData?.priceCents ?? 10000;

  const handleCopy = useCallback((e: React.MouseEvent, content: string, promptId: number) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(promptId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  async function handleBuyCollection() {
    if (!isSignedIn) return;
    setBuying(true);
    try {
      const r = await fetch(`${basePath}/api/checkout/library/${libraryId}`, { method: "POST", credentials: "include" });
      const { purchaseUrl } = await r.json();
      if (purchaseUrl) window.location.href = purchaseUrl;
      else setBuying(false);
    } catch {
      setBuying(false);
    }
  }

  async function savePrice() {
    const cents = strToCents(priceInput);
    setSavingPrice(true);
    await fetch(`${basePath}/api/libraries/${libraryId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceCents: cents }),
    });
    await queryClient.invalidateQueries({ queryKey: getGetLibraryQueryKey(libraryId) });
    await queryClient.invalidateQueries({ queryKey: ["library-access", libraryId] });
    setSavingPrice(false);
    setEditingPrice(false);
  }

  async function clearPrice() {
    setSavingPrice(true);
    await fetch(`${basePath}/api/libraries/${libraryId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceCents: null }),
    });
    await queryClient.invalidateQueries({ queryKey: getGetLibraryQueryKey(libraryId) });
    await queryClient.invalidateQueries({ queryKey: ["library-access", libraryId] });
    setSavingPrice(false);
    setEditingPrice(false);
  }

  /* ── loading / error states ─────────────────────────────────────── */

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="bg-white border-b border-black/[0.05] px-6 py-14">
            <div className="max-w-5xl mx-auto">
              <Skeleton className="h-4 w-24 mb-6 rounded-lg" />
              <Skeleton className="h-8 w-80 mb-3 rounded-xl" />
              <Skeleton className="h-5 w-full max-w-xl mb-2 rounded-lg" />
              <Skeleton className="h-10 w-40 mt-6 rounded-full" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
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

  const prompts: PromptItem[] = (library.prompts ?? []) as PromptItem[];
  const accent = collectionAccent(prompts);

  const groups = prompts.reduce<Record<string, PromptItem[]>>((acc, p) => {
    const key = p.subcategoryName ?? p.categoryName ?? "Other";
    acc[key] = acc[key] ? [...acc[key], p] : [p];
    return acc;
  }, {});
  const hasMultipleGroups = Object.keys(groups).length > 1;

  /* ── render ──────────────────────────────────────────────────────── */

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.05]" style={{ borderTop: `4px solid ${accent.color}` }}>
          <div className="max-w-5xl mx-auto px-6 py-12">
            <Link
              href={`/profile/${library.authorUsername}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {library.authorDisplayName}
            </Link>

            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: accent.subtle }}>
                <BookOpen className="h-7 w-7" style={{ color: accent.color }} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Eyebrow */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent.color }}>
                    Curated collection
                  </span>
                  {accent.label && (
                    <>
                      <span className="text-[11px] text-foreground/30">·</span>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground/35">
                        {accent.label}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-3">{library.name}</h1>

                {library.description && (
                  <p className="text-[16px] text-foreground/60 leading-relaxed max-w-2xl mb-4">{library.description}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 text-[13px] mb-5">
                  <Link href={`/profile/${library.authorUsername}`} className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground transition-colors">
                    <span>By</span>
                    <span className="font-medium">{library.authorDisplayName}</span>
                  </Link>
                  <span className="text-foreground/25">·</span>
                  <span className="font-semibold px-2.5 py-1 rounded-full text-[12px]" style={{ background: accent.subtle, color: accent.color }}>
                    {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
                  </span>
                  {(library as any).priceCents != null && (
                    <span className="font-semibold px-2.5 py-1 rounded-full text-[12px] bg-[#f5f5f7] text-foreground/55">
                      {fmt((library as any).priceCents)}
                    </span>
                  )}
                </div>

                {/* ── Access / CTA area ── */}
                {isOwner ? (
                  /* Owner: price editor */
                  <div>
                    {editingPrice ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
                          <input
                            type="number" min="0.01" step="0.01" value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            placeholder={(priceCents / 100).toFixed(2)}
                            className="pl-6 pr-3 py-2 bg-[#f5f5f7] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20 w-28"
                            autoFocus
                          />
                        </div>
                        <button onClick={savePrice} disabled={savingPrice}
                          className="px-3 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                          {savingPrice ? "Saving…" : "Set price"}
                        </button>
                        {(library as any).priceCents != null && (
                          <button onClick={clearPrice} disabled={savingPrice}
                            className="px-3 py-2 text-[12px] text-foreground/50 hover:text-foreground rounded-xl hover:bg-[#f5f5f7] transition-colors">
                            Use default
                          </button>
                        )}
                        <button onClick={() => setEditingPrice(false)}
                          className="px-3 py-2 text-[12px] text-foreground/40 hover:text-foreground rounded-xl hover:bg-[#f5f5f7] transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPriceInput((library as any).priceCents ? centsToStr((library as any).priceCents) : "");
                          setEditingPrice(true);
                        }}
                        className="flex items-center gap-1.5 text-[12px] text-foreground/40 hover:text-foreground/70 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        {(library as any).priceCents ? `Collection price: ${fmt((library as any).priceCents)} — edit` : "Set collection price"}
                      </button>
                    )}
                  </div>
                ) : accessLoading ? (
                  <div className="h-10 w-40 bg-foreground/[0.06] rounded-full animate-pulse" />
                ) : hasAccess ? (
                  /* Purchased */
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold bg-green-50 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Collection unlocked
                  </div>
                ) : isSignedIn ? (
                  /* Signed in, not purchased */
                  <button
                    onClick={handleBuyCollection}
                    disabled={buying}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--orange)" }}
                  >
                    {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                    {buying ? "Redirecting…" : `Buy collection · ${fmt(priceCents)}`}
                  </button>
                ) : (
                  /* Unauthenticated */
                  <SignInButton mode="modal">
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] text-white transition-opacity hover:opacity-80" style={{ background: "var(--orange)" }}>
                      <ShoppingBag className="h-4 w-4" />
                      Buy collection · {fmt(priceCents)}
                    </button>
                  </SignInButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Prompts ──────────────────────────────────────────────── */}
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
            <div className="space-y-10">
              {Object.entries(groups).map(([groupName, groupPrompts]) => (
                <div key={groupName}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: accent.subtle, color: accent.color }}
                    >
                      {groupName}
                    </span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                    <span className="text-[11px] text-foreground/30">{groupPrompts.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupPrompts.map(p => (
                      <PromptCard
                        key={p.id} prompt={p} accent={accent}
                        onCopy={handleCopy} copied={copiedId === p.id}
                        locked={!hasAccess}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prompts.map(p => (
                <PromptCard
                  key={p.id} prompt={p} accent={accent}
                  onCopy={handleCopy} copied={copiedId === p.id}
                  locked={!hasAccess}
                />
              ))}
            </div>
          )}

          {/* ── Bottom CTA ── only when not owner and not purchased ── */}
          {!isOwner && !accessLoading && !hasAccess && prompts.length > 0 && (
            <CollectionBuyBar
              priceCents={priceCents}
              promptCount={prompts.length}
              authorName={library.authorDisplayName}
              onBuy={handleBuyCollection}
              buying={buying}
              isSignedIn={!!isSignedIn}
            />
          )}
        </div>

      </div>
    </Layout>
  );
}
