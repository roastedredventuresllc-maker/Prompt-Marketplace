import { useEffect, useState, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/react";
import { Link } from "wouter";
import { Lock, Zap, BookOpen, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

type AccessStatus = {
  hasAccess: boolean;
  reason: "purchased" | "free" | "library" | "unauthenticated" | "free_available" | "limit_reached";
  freePromptsRemaining: number;
  priceCents: number;
};

type Props = {
  promptId: number;
  accentColor?: string | null;
  /** true when displaying inside a library-detail (unlocks whole collection) */
  libraryId?: number;
  /** Called after free-use or post-payment to let the parent re-fetch content */
  onAccessGranted?: () => void;
  children: React.ReactNode;
};

const BASE = "/api";

async function fetchAccess(promptId: number): Promise<AccessStatus> {
  const r = await fetch(`${BASE}/access/prompt/${promptId}`, { credentials: "include" });
  return r.json();
}

async function recordFreeUse(promptId: number): Promise<{ success: boolean; freePromptsRemaining: number }> {
  const r = await fetch(`${BASE}/access/free-use/${promptId}`, { method: "POST", credentials: "include" });
  return r.json();
}

async function createCheckout(promptId: number): Promise<{ purchaseUrl: string; priceCents: number }> {
  const r = await fetch(`${BASE}/checkout/prompt/${promptId}`, { method: "POST", credentials: "include" });
  return r.json();
}

async function createCollectionCheckout(libraryId: number): Promise<{ purchaseUrl: string; priceCents: number }> {
  const r = await fetch(`${BASE}/checkout/library/${libraryId}`, { method: "POST", credentials: "include" });
  return r.json();
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/* ── Blurred preview overlay ─────────────────────────────────────────── */
function BlurredContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative select-none pointer-events-none">
      <div className="blur-sm opacity-40 overflow-hidden max-h-48">{children}</div>
    </div>
  );
}

/* ── Individual paywall panels ───────────────────────────────────────── */
function UnauthPanel({ accentColor }: { accentColor?: string | null }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentColor ? `${accentColor}15` : "#F5F5F7" }}
      >
        <Lock className="h-6 w-6" style={{ color: accentColor ?? "rgba(0,0,0,0.4)" }} />
      </div>
      <div>
        <h3 className="font-bold text-[18px] mb-1">Sign up for 3 free prompts</h3>
        <p className="text-[14px] text-foreground/55 max-w-xs">
          Create a free account to unlock 3 expert prompts — no credit card required.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <SignInButton mode="modal" signUpForceRedirectUrl={window.location.href}>
          <button
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white transition-opacity hover:opacity-80 w-full sm:w-auto"
            style={{ background: accentColor ?? "#1d1d1f" }}
          >
            <Zap className="h-4 w-4" />
            Get 3 free prompts
          </button>
        </SignInButton>
        <SignInButton mode="modal" signUpForceRedirectUrl={window.location.href}>
          <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium text-[14px] bg-white border border-black/[0.10] hover:border-black/25 transition-all w-full sm:w-auto text-foreground/70">
            Sign in
          </button>
        </SignInButton>
      </div>
      <p className="text-[12px] text-foreground/35">Already a member? Sign in above.</p>
    </div>
  );
}

function FreePanel({
  freeRemaining,
  accentColor,
  onUse,
  loading,
}: {
  freeRemaining: number;
  accentColor?: string | null;
  onUse: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentColor ? `${accentColor}15` : "#F5F5F7" }}
      >
        <Zap className="h-6 w-6" style={{ color: accentColor ?? "rgba(0,0,0,0.4)" }} />
      </div>
      <div>
        <h3 className="font-bold text-[18px] mb-1">
          {freeRemaining === 3 ? "You have 3 free prompts" : `${freeRemaining} free prompt${freeRemaining !== 1 ? "s" : ""} remaining`}
        </h3>
        <p className="text-[14px] text-foreground/55 max-w-xs">
          Use one of your free prompts to unlock this content instantly.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onUse}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: accentColor ?? "#1d1d1f" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Use 1 free prompt
        </button>
      </div>
      <p className="text-[12px] text-foreground/35">
        After using all free prompts, prompts are ${"{"}5{"}"} each or ${"{"}100{"}"} per collection.
      </p>
    </div>
  );
}

function PurchasePanel({
  priceCents,
  libraryId,
  accentColor,
  onBuy,
  onBuyCollection,
  loading,
}: {
  priceCents: number;
  libraryId?: number;
  accentColor?: string | null;
  onBuy: () => void;
  onBuyCollection?: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentColor ? `${accentColor}15` : "#F5F5F7" }}
      >
        <Lock className="h-6 w-6" style={{ color: accentColor ?? "rgba(0,0,0,0.4)" }} />
      </div>
      <div>
        <h3 className="font-bold text-[18px] mb-1">Unlock this prompt</h3>
        <p className="text-[14px] text-foreground/55 max-w-xs">
          You've used your 3 free prompts. Purchase to access this expert-curated content.
        </p>
      </div>

      {/* Pricing options */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onBuy}
          disabled={loading}
          className="flex-1 flex flex-col items-center justify-center gap-1 px-5 py-4 rounded-2xl font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: accentColor ?? "#1d1d1f" }}
        >
          <span className="text-[22px] font-bold">{formatPrice(priceCents)}</span>
          <span className="text-[12px] opacity-80">This prompt</span>
        </button>

        {libraryId && (
          <button
            onClick={onBuyCollection}
            disabled={loading}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-5 py-4 rounded-2xl font-semibold transition-all border border-black/[0.10] hover:border-black/25 disabled:opacity-50 bg-white"
          >
            <span className="text-[22px] font-bold">$100</span>
            <span className="text-[12px] text-foreground/50">Full collection</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-foreground/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Redirecting to checkout…
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-[12px] text-foreground/40">
        <div className="flex items-center gap-1.5 justify-center">
          <CheckCircle className="h-3.5 w-3.5" style={{ color: accentColor ?? "rgba(0,0,0,0.3)" }} />
          One-time purchase — yours forever
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <CheckCircle className="h-3.5 w-3.5" style={{ color: accentColor ?? "rgba(0,0,0,0.3)" }} />
          Secured by Whop
        </div>
      </div>
    </div>
  );
}

/* ── Main PaywallGate ─────────────────────────────────────────────────── */
export function PaywallGate({ promptId, accentColor, libraryId, onAccessGranted, children }: Props) {
  const { isSignedIn, isLoaded } = useUser();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!isLoaded) return;
    setAccessLoading(true);
    try {
      const status = await fetchAccess(promptId);
      setAccess(status);
    } catch {
      setAccess({ hasAccess: false, reason: "unauthenticated", freePromptsRemaining: 3, priceCents: 500 });
    } finally {
      setAccessLoading(false);
    }
  }, [promptId, isLoaded]);

  useEffect(() => { checkAccess(); }, [checkAccess]);

  const handleFreeUse = async () => {
    setActionLoading(true);
    try {
      const result = await recordFreeUse(promptId);
      if (result.success) {
        setAccess((prev) => prev ? { ...prev, hasAccess: true, reason: "free" } : prev);
        onAccessGranted?.();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuy = async () => {
    setActionLoading(true);
    try {
      const { purchaseUrl } = await createCheckout(promptId);
      if (purchaseUrl) window.location.href = purchaseUrl;
    } catch {
      setActionLoading(false);
    }
  };

  const handleBuyCollection = async () => {
    if (!libraryId) return;
    setActionLoading(true);
    try {
      const { purchaseUrl } = await createCollectionCheckout(libraryId);
      if (purchaseUrl) window.location.href = purchaseUrl;
    } catch {
      setActionLoading(false);
    }
  };

  // Still loading Clerk or access check
  if (!isLoaded || accessLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05] animate-pulse min-h-[200px]" />
    );
  }

  // Access granted — render children
  if (access?.hasAccess) {
    return <>{children}</>;
  }

  const reason = access?.reason ?? "unauthenticated";
  const priceCents = access?.priceCents ?? 500;
  const freeRemaining = access?.freePromptsRemaining ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.05] overflow-hidden">
      {/* Blurred preview of content */}
      <div className="p-8 pb-0">
        <BlurredContent>{children}</BlurredContent>
      </div>

      {/* Divider */}
      <div className="relative flex items-center my-0 px-8">
        <div className="flex-1 h-px bg-black/[0.06]" />
        <div
          className="mx-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-white shrink-0"
          style={{ background: accentColor ?? "#1d1d1f" }}
        >
          {reason === "unauthenticated" ? "Free access" : reason === "free_available" ? "Use free prompt" : "Unlock prompt"}
        </div>
        <div className="flex-1 h-px bg-black/[0.06]" />
      </div>

      {/* Gate panel */}
      <div className="px-8 pb-8">
        {!isSignedIn || reason === "unauthenticated" ? (
          <UnauthPanel accentColor={accentColor} />
        ) : reason === "free_available" ? (
          <FreePanel freeRemaining={freeRemaining} accentColor={accentColor} onUse={handleFreeUse} loading={actionLoading} />
        ) : (
          <PurchasePanel
            priceCents={priceCents}
            libraryId={libraryId}
            accentColor={accentColor}
            onBuy={handleBuy}
            onBuyCollection={handleBuyCollection}
            loading={actionLoading}
          />
        )}
      </div>
    </div>
  );
}
