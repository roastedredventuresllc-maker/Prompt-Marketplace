import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useUser } from "@clerk/react";
import {
  ArrowLeft, Save, DollarSign, Loader2, CheckCircle, AlertCircle,
  Key, Plus, Trash2, Eye, Copy, Check, RefreshCw, Plug,
} from "lucide-react";

const MCP_URL = "https://prompt-marketplace99.replit.app/api/mcp";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── types ────────────────────────────────────────────────────────────────

type Pricing = { promptPriceCents: number; collectionPriceCents: number; username: string };

type ApiKey = {
  id: number;
  name: string;
  keyPrefix: string;
  creditsCents: number;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

// ── helpers ──────────────────────────────────────────────────────────────

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
function parseDollarsToInts(val: string): number | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}
function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Pricing settings panel ────────────────────────────────────────────────

function PricingPanel() {
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
        if (r.status === 404) { setNeedsOnboarding(true); return null; }
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
    if (!promptPriceCents || !collectionPriceCents) { setSaveState("error"); return; }
    setSaving(true); setSaveState("idle");
    try {
      const r = await fetch(`${basePath}/api/settings/pricing`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ promptPriceCents, collectionPriceCents }),
      });
      const data = await r.json();
      if (r.ok) {
        setPricing((p) => p ? { ...p, ...data } : p);
        setSaveState("success");
        setTimeout(() => setSaveState("idle"), 3000);
      } else { setSaveState("error"); }
    } catch { setSaveState("error"); } finally { setSaving(false); }
  };

  if (!isLoaded || loading || needsOnboarding) {
    return (
      <div className="bg-white rounded-2xl p-8 space-y-6 animate-pulse">
        {Array(2).fill(0).map((_, i) => <div key={i} className="h-16 bg-black/[0.04] rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-black/[0.05] space-y-7">
      <div>
        <label className="block text-[13px] font-semibold text-foreground/70 mb-2">Price per prompt</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-[15px] font-medium select-none">$</span>
          <input type="number" min="1" step="0.01" value={promptPrice}
            onChange={(e) => setPromptPrice(e.target.value)}
            className="w-full pl-8 pr-4 py-3 border border-black/[0.10] rounded-xl text-[15px] font-medium focus:outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)] focus:ring-opacity-20 transition-all"
            placeholder="5.00" />
        </div>
        <p className="text-[12px] text-foreground/40 mt-1.5">What buyers pay to access a single prompt.</p>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-foreground/70 mb-2">Price per collection</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-[15px] font-medium select-none">$</span>
          <input type="number" min="1" step="0.01" value={collectionPrice}
            onChange={(e) => setCollectionPrice(e.target.value)}
            className="w-full pl-8 pr-4 py-3 border border-black/[0.10] rounded-xl text-[15px] font-medium focus:outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)] focus:ring-opacity-20 transition-all"
            placeholder="100.00" />
        </div>
        <p className="text-[12px] text-foreground/40 mt-1.5">What buyers pay for full access to one of your curated collections.</p>
      </div>

      <div className="bg-[#F5F5F7] rounded-xl p-4 text-[13px] text-foreground/55 leading-relaxed">
        These are your default prices. You can override the price for individual collections from the collection page. Firm pricing is managed separately in{" "}
        <Link href="/firms" className="underline hover:text-foreground">My firms</Link>.
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
  );
}

// ── Claude connect panel ──────────────────────────────────────────────────

function ClaudeConnectPanel({ mcpKey: _ }: { mcpKey: string }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [tab, setTab] = useState<"oauth" | "key">("oauth");

  function copyUrl() {
    navigator.clipboard.writeText(MCP_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <div className="bg-[#1d1d1f] rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-white/40 shrink-0" />
        <p className="text-[11px] font-sans font-semibold tracking-wide uppercase text-white/40">Connect to Claude</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
        <button
          onClick={() => setTab("oauth")}
          className={`flex-1 text-[11px] font-sans font-medium py-1.5 rounded-lg transition-colors ${tab === "oauth" ? "bg-white/[0.12] text-white" : "text-white/40 hover:text-white/60"}`}
        >
          OAuth (recommended)
        </button>
        <button
          onClick={() => setTab("key")}
          className={`flex-1 text-[11px] font-sans font-medium py-1.5 rounded-lg transition-colors ${tab === "key" ? "bg-white/[0.12] text-white" : "text-white/40 hover:text-white/60"}`}
        >
          API Key URL
        </button>
      </div>

      {tab === "oauth" ? (
        <ol className="space-y-4 list-none">
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-[12px] text-white/60 font-sans leading-relaxed">
              In Claude → <span className="text-white/80">Settings → Connectors → Add custom connector</span>
            </p>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
            <div className="flex-1 space-y-2">
              <p className="text-[12px] text-white/60 font-sans">
                Paste this as the <span className="text-white/80">Remote MCP Server URL</span>:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[11px] text-green-400 bg-white/[0.05] rounded-xl px-3 py-2.5 break-all">
                  {MCP_URL}
                </code>
                <button onClick={copyUrl} className="shrink-0 p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] transition-colors">
                  {copiedUrl ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-white/50" />}
                </button>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-[12px] text-white/60 font-sans leading-relaxed">
              Give it a name (e.g. <span className="text-white/80">Promptly</span>) and save. Claude will open a sign-in pop-up — log in and click <span className="text-white/80">Authorize Claude</span>. A dedicated key is created automatically.
            </p>
          </li>
        </ol>
      ) : (
        <ol className="space-y-4 list-none">
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-[12px] text-white/60 font-sans leading-relaxed">
              From the table above, click <span className="text-white/80">Reveal</span> on any API key and copy the full <span className="text-white/80 font-mono">sk_…</span> value.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
            <div className="flex-1 space-y-2">
              <p className="text-[12px] text-white/60 font-sans">
                In Claude → <span className="text-white/80">Settings → Connectors → Add custom connector</span>. Use this URL pattern, substituting your key:
              </p>
              <code className="block font-mono text-[11px] text-green-400 bg-white/[0.05] rounded-xl px-3 py-2.5 break-all">
                {MCP_URL}?key=sk_YOUR_KEY_HERE
              </code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/40 text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-[12px] text-white/60 font-sans leading-relaxed">
              Give it a name, save, and connect — no sign-in pop-up needed. Claude will be authenticated as <span className="text-white/80">your account</span> immediately.
            </p>
          </li>
        </ol>
      )}

      <p className="text-[11px] text-white/25 font-sans leading-relaxed border-t border-white/[0.06] pt-4">
        {tab === "oauth"
          ? "OAuth creates a dedicated key named "Claude (auto)" — add credits to it from the table above before buying prompts."
          : "Keep your key private — anyone with it can act as you. Use a dedicated key (not your main one) and set a spending limit."}
      </p>
    </div>
  );
}

// ── API Keys panel ────────────────────────────────────────────────────────

function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<{ id: number; raw: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [topupId, setTopupId] = useState<number | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupSaving, setTopupSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadKeys() {
    setLoading(true);
    const r = await fetch(`${basePath}/api/agent/keys`, { credentials: "include" });
    if (r.ok) setKeys(await r.json());
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setError("");
    const r = await fetch(`${basePath}/api/agent/keys`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() || "My key" }),
    });
    const data = await r.json();
    if (r.ok) {
      setRevealedKey({ id: data.id, raw: data.rawKey });
      setNewKeyName("");
      await loadKeys();
    } else {
      setError(data.error ?? "Failed to create key");
    }
    setCreating(false);
  }

  async function handleRevoke(id: number) {
    if (!confirm("Revoke this key? Any agent using it will immediately lose access.")) return;
    await fetch(`${basePath}/api/agent/keys/${id}`, { method: "DELETE", credentials: "include" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
    if (revealedKey?.id === id) setRevealedKey(null);
  }

  async function handleTopup(e: React.FormEvent, id: number) {
    e.preventDefault();
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) return;
    setTopupSaving(true);
    const r = await fetch(`${basePath}/api/agent/keys/${id}/topup`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountDollars: amount }),
    });
    if (r.ok) {
      const data = await r.json();
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, creditsCents: data.creditsCents } : k));
    }
    setTopupSaving(false);
    setTopupId(null);
    setTopupAmount("");
  }

  function copyKey(raw: string, id: number) {
    navigator.clipboard.writeText(raw);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array(2).fill(0).map((_, i) => <div key={i} className="h-20 bg-black/[0.04] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div className="bg-[#F5F5F7] rounded-2xl p-5 text-[13px] text-foreground/60 leading-relaxed space-y-2">
        <p>
          <span className="font-semibold text-foreground">API keys</span> let AI agents browse and purchase prompts programmatically —
          no browser needed. Each key has a credit balance that gets deducted when an agent buys a prompt.
        </p>
        <p>
          Connect your agent via the <span className="font-mono text-[12px] bg-black/[0.06] px-1 py-0.5 rounded">MCP server</span> or call the REST API directly.
          See <span className="font-mono text-[12px] bg-black/[0.06] px-1 py-0.5 rounded">/llms.txt</span> for full documentation.
        </p>
      </div>

      {/* Revealed key banner — shown once after creation */}
      {revealedKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-[13px] font-semibold text-amber-800">Copy this key now — it won't be shown again.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[12px] bg-white border border-amber-200 rounded-xl px-4 py-2.5 break-all text-amber-900">
              {revealedKey.raw}
            </code>
            <button onClick={() => copyKey(revealedKey.raw, revealedKey.id)}
              className="shrink-0 p-2 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors">
              {copiedId === revealedKey.id ? <Check className="h-4 w-4 text-amber-700" /> : <Copy className="h-4 w-4 text-amber-700" />}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)}
            className="text-[12px] text-amber-600 hover:text-amber-800 transition-colors">
            I've saved it, dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      {keys.map((key) => (
        <div key={key.id} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                <span className="text-[14px] font-semibold truncate">{key.name}</span>
              </div>
              <code className="text-[12px] text-foreground/40 font-mono">{key.keyPrefix}…</code>
              <div className="flex items-center gap-3 mt-2 text-[12px] text-foreground/40">
                <span>Last used: {timeAgo(key.lastUsedAt)}</span>
                <span>·</span>
                <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <button onClick={() => handleRevoke(key.id)}
              className="shrink-0 p-2 rounded-lg text-foreground/30 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Credits */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-foreground/50">Balance:</span>
              <span className="text-[14px] font-semibold" style={{ color: key.creditsCents > 0 ? "var(--orange)" : undefined }}>
                ${centsToDisplay(key.creditsCents)}
              </span>
            </div>
            {topupId === key.id ? (
              <form onSubmit={(e) => handleTopup(e, key.id)} className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
                  <input
                    type="number" min="1" step="1" autoFocus
                    value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="10"
                    className="w-24 pl-7 pr-3 py-1.5 border border-black/[0.10] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <button type="submit" disabled={topupSaving}
                  className="px-3 py-1.5 bg-foreground text-background text-[12px] font-medium rounded-lg hover:opacity-80 disabled:opacity-50">
                  {topupSaving ? "…" : "Add"}
                </button>
                <button type="button" onClick={() => { setTopupId(null); setTopupAmount(""); }}
                  className="text-[12px] text-foreground/40 hover:text-foreground transition-colors">Cancel</button>
              </form>
            ) : (
              <button onClick={() => setTopupId(key.id)}
                className="flex items-center gap-1 text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-black/[0.04]">
                <Plus className="h-3 w-3" /> Add credits
              </button>
            )}
          </div>
        </div>
      ))}

      {keys.length === 0 && !revealedKey && (
        <div className="text-center py-10 text-foreground/40 text-[14px]">
          No API keys yet. Generate one below to get started.
        </div>
      )}

      {/* Create form */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl">{error}</div>
      )}
      <form onSubmit={handleCreate} className="flex items-center gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (optional)"
          className="flex-1 bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button type="submit" disabled={creating}
          className="flex items-center gap-1.5 bg-foreground text-background px-5 py-2.5 rounded-full text-[13px] font-medium hover:opacity-80 disabled:opacity-50 transition-opacity shrink-0">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Generate key
        </button>
      </form>

      {/* Connect to Claude */}
      {keys.length > 0 && <ClaudeConnectPanel mcpKey={keys[0].keyPrefix} />}
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────

type Tab = "pricing" | "keys";

export default function Settings() {
  const { isSignedIn, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("pricing");

  if (!isLoaded) {
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

          <Link href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <h1 className="text-[24px] font-bold tracking-tight mb-6">Settings</h1>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-8 bg-white rounded-2xl p-1 border border-black/[0.06] shadow-sm w-fit">
            <button
              onClick={() => setTab("pricing")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-colors ${tab === "pricing" ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"}`}
            >
              <DollarSign className="h-3.5 w-3.5" /> Pricing
            </button>
            <button
              onClick={() => setTab("keys")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-colors ${tab === "keys" ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"}`}
            >
              <Key className="h-3.5 w-3.5" /> API Keys
            </button>
          </div>

          {tab === "pricing" && <PricingPanel />}
          {tab === "keys" && <ApiKeysPanel />}

        </div>
      </div>
    </Layout>
  );
}
