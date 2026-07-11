import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useUser } from "@clerk/react";
import { ArrowLeft, Save, DollarSign, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Pricing = {
  promptPriceCents: number;
  collectionPriceCents: number;
  username: string;
};

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function parseDollarsToInts(val: string): number | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function Settings() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");

  const [promptPrice, setPromptPrice] = useState("");
  const [collectionPrice, setCollectionPrice] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch(`${basePath}/api/settings/pricing`, { credentials: "include" })
      .then((r) => {
        // A signed-in user without a local profile yet (hasn't finished
        // onboarding) can't have pricing — send them to set up their
        // profile instead of showing a confusing save error later.
        if (r.status === 404) {
          setNeedsOnboarding(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setPricing(data);
        setPromptPrice(centsToDisplay(data.promptPriceCents ?? 500));
        setCollectionPrice(centsToDisplay(data.collectionPriceCents ?? 10000));
      })
      .catch(() => setPricing(null))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (needsOnboarding) {
      sessionStorage.setItem("onboardingReturnTo", "/settings");
      setLocation("/onboarding");
    }
  }, [needsOnboarding, setLocation]);

  const handleSave = async () => {
    const promptPriceCents = parseDollarsToInts(promptPrice);
    const collectionPriceCents = parseDollarsToInts(collectionPrice);
    if (!promptPriceCents || !collectionPriceCents) {
      setSaveState("error");
      return;
    }

    setSaving(true);
    setSaveState("idle");
    try {
      const r = await fetch(`${basePath}/api/settings/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ promptPriceCents, collectionPriceCents }),
      });
      const data = await r.json();
      if (r.ok) {
        setPricing((p) => p ? { ...p, ...data } : p);
        setSaveState("success");
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading || needsOnboarding) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="h-8 w-48 bg-black/[0.06] rounded-lg animate-pulse mb-10" />
          <div className="bg-white rounded-2xl p-8 space-y-6 animate-pulse">
            {Array(2).fill(0).map((_, i) => <div key={i} className="h-16 bg-black/[0.04] rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-6">
          <p className="text-[15px] text-foreground/50">Sign in to access settings.</p>
          <Link href="/" className="text-[14px] hover:underline">Go home</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">
        <div className="max-w-2xl mx-auto px-6 py-14">

          <Link href={pricing?.username ? `/profile/${pricing.username}` : "/"}
            className="inline-flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "var(--orange-subtle)" }}>
              <DollarSign className="h-5 w-5" style={{ color: "var(--orange)" }} />
            </div>
            <div>
              <h1 className="text-[24px] font-bold tracking-tight">Pricing settings</h1>
              <p className="text-[13px] text-foreground/45">Set what buyers pay to access your prompts and collections</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-black/[0.05] space-y-7">

            <div>
              <label className="block text-[13px] font-semibold text-foreground/70 mb-2">Price per prompt</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-[15px] font-medium select-none">$</span>
                <input type="number" min="1" step="0.01" value={promptPrice} onChange={(e) => setPromptPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-black/[0.10] rounded-xl text-[15px] font-medium focus:outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)] focus:ring-opacity-20 transition-all"
                  placeholder="5.00" />
              </div>
              <p className="text-[12px] text-foreground/40 mt-1.5">What buyers pay to access a single prompt from your profile.</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground/70 mb-2">Price per collection</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-[15px] font-medium select-none">$</span>
                <input type="number" min="1" step="0.01" value={collectionPrice} onChange={(e) => setCollectionPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-black/[0.10] rounded-xl text-[15px] font-medium focus:outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)] focus:ring-opacity-20 transition-all"
                  placeholder="100.00" />
              </div>
              <p className="text-[12px] text-foreground/40 mt-1.5">What buyers pay for full access to one of your curated collections.</p>
            </div>

            <div className="bg-[#F5F5F7] rounded-xl p-4 text-[13px] text-foreground/55 leading-relaxed">
              These are your default prices. You can override the price for individual collections from the collection page. Prices apply to new purchases — existing buyers keep access at the price they paid. Firm pricing is managed separately in <Link href="/firms" className="underline hover:text-foreground">My firms</Link>.
            </div>

            <div className="flex items-center gap-4">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ background: "var(--orange)" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save pricing"}
              </button>
              {saveState === "success" && (
                <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--orange)" }}>
                  <CheckCircle className="h-4 w-4" /> Saved
                </div>
              )}
              {saveState === "error" && (
                <div className="flex items-center gap-1.5 text-[13px] text-red-500">
                  <AlertCircle className="h-4 w-4" /> Please enter valid prices
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
