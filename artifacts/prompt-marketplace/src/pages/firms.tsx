import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, UserPlus, X, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminEntry = { clerkUserId: string; username: string; displayName: string };
type Firm = {
  id: number;
  username: string;
  displayName: string;
  orgName: string | null;
  bio: string | null;
  categories: string[];
  promptPriceCents: number;
  collectionPriceCents: number;
  adminClerkUserIds: string[];
  admins: AdminEntry[];
};

function useFirms(enabled: boolean) {
  return useQuery<Firm[]>({
    queryKey: ["firms", "mine"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/firms/mine`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
  });
}

function centsToStr(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
function strToCents(val: string): number | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function FirmCard({
  firm,
  isOwner,
  onUpdate,
  onDelete,
}: {
  firm: Firm;
  isOwner: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);

  // Info edit form
  const [name, setName] = useState(firm.orgName ?? firm.displayName);
  const [bio, setBio] = useState(firm.bio ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  // Pricing edit
  const [editingPricing, setEditingPricing] = useState(false);
  const [promptPrice, setPromptPrice] = useState(centsToStr(firm.promptPriceCents));
  const [collectionPrice, setCollectionPrice] = useState(centsToStr(firm.collectionPriceCents));
  const [savingPricing, setSavingPricing] = useState(false);

  // Admin management
  const [adminInput, setAdminInput] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const { userId } = useAuth();

  async function saveInfo() {
    if (!name.trim()) return;
    setSavingInfo(true);
    await fetch(`${basePath}/api/firms/${firm.username}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), bio: bio.trim() }),
    });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    setSavingInfo(false);
    setEditingInfo(false);
    onUpdate();
  }

  async function savePricing() {
    const promptPriceCents = strToCents(promptPrice);
    const collectionPriceCents = strToCents(collectionPrice);
    if (!promptPriceCents || !collectionPriceCents) return;
    setSavingPricing(true);
    await fetch(`${basePath}/api/firms/${firm.username}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptPriceCents, collectionPriceCents }),
    });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    setSavingPricing(false);
    setEditingPricing(false);
    onUpdate();
  }

  async function addAdmin() {
    if (!adminInput.trim()) return;
    setAddingAdmin(true);
    setAdminError("");
    const res = await fetch(`${basePath}/api/firms/${firm.username}/admins`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername: adminInput.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setAdminError((j as any).error ?? "Failed to add admin");
    } else {
      setAdminInput("");
      await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    }
    setAddingAdmin(false);
  }

  async function removeAdmin(clerkId: string) {
    await fetch(`${basePath}/api/firms/${firm.username}/admins/${encodeURIComponent(clerkId)}`, {
      method: "DELETE", credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 text-[16px]" style={{ background: "var(--orange)" }}>
          {(firm.orgName ?? firm.displayName)[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px] truncate">{firm.orgName ?? firm.displayName}</p>
          <p className="text-[12px] text-foreground/40">@{firm.username}</p>
          {firm.bio && <p className="text-[12px] text-foreground/50 mt-0.5 truncate">{firm.bio}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/profile/${firm.username}`} className="px-3 py-1.5 rounded-lg text-[12px] text-foreground/50 hover:bg-[#f5f5f7] hover:text-foreground transition-colors">
            View
          </Link>
          <button onClick={() => setExpanded(e => !e)} className="p-2 rounded-lg text-foreground/40 hover:bg-[#f5f5f7] hover:text-foreground transition-colors" title="Manage">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {isOwner && (
            <button onClick={onDelete} className="p-2 rounded-lg text-foreground/30 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete firm">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-black/[0.05] divide-y divide-black/[0.04]">

          {/* Edit info */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-foreground/40">Details</p>
              <button onClick={() => setEditingInfo(e => !e)} className="flex items-center gap-1 text-[12px] text-foreground/50 hover:text-foreground transition-colors">
                <Pencil className="h-3 w-3" /> {editingInfo ? "Cancel" : "Edit"}
              </button>
            </div>
            {editingInfo ? (
              <div className="space-y-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Firm name"
                  className="w-full bg-[#f5f5f7] rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                <input value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio (optional)"
                  className="w-full bg-[#f5f5f7] rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                <button onClick={saveInfo} disabled={savingInfo || !name.trim()}
                  className="bg-foreground text-background px-4 py-2 rounded-full text-[12px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                  {savingInfo ? "Saving…" : "Save"}
                </button>
              </div>
            ) : (
              <div className="text-[13px] text-foreground/60 space-y-0.5">
                <p className="font-medium text-foreground">{firm.orgName ?? firm.displayName}</p>
                {firm.bio && <p>{firm.bio}</p>}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-foreground/40">Pricing</p>
              {isOwner && (
                <button onClick={() => setEditingPricing(e => !e)} className="flex items-center gap-1 text-[12px] text-foreground/50 hover:text-foreground transition-colors">
                  <Pencil className="h-3 w-3" /> {editingPricing ? "Cancel" : "Edit"}
                </button>
              )}
            </div>
            {editingPricing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-foreground/50 mb-1">Per prompt</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
                      <input type="number" min="0.01" step="0.01" value={promptPrice} onChange={e => setPromptPrice(e.target.value)}
                        className="w-full pl-6 pr-3 py-2 bg-[#f5f5f7] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-foreground/50 mb-1">Per collection</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
                      <input type="number" min="0.01" step="0.01" value={collectionPrice} onChange={e => setCollectionPrice(e.target.value)}
                        className="w-full pl-6 pr-3 py-2 bg-[#f5f5f7] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                    </div>
                  </div>
                </div>
                <button onClick={savePricing} disabled={savingPricing}
                  className="bg-foreground text-background px-4 py-2 rounded-full text-[12px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                  {savingPricing ? "Saving…" : "Save pricing"}
                </button>
              </div>
            ) : (
              <div className="flex gap-4 text-[13px]">
                <span className="text-foreground/60">Prompt: <span className="font-semibold text-foreground">${centsToStr(firm.promptPriceCents)}</span></span>
                <span className="text-foreground/60">Collection: <span className="font-semibold text-foreground">${centsToStr(firm.collectionPriceCents)}</span></span>
              </div>
            )}
          </div>

          {/* Admins — only owner can manage */}
          {isOwner && (
            <div className="px-5 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-3">Shared admins</p>
              {firm.admins.length > 0 && (
                <div className="space-y-2 mb-3">
                  {firm.admins.map(admin => (
                    <div key={admin.clerkUserId} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-foreground/[0.08] flex items-center justify-center text-[10px] font-semibold">
                        {admin.displayName[0]}
                      </div>
                      <span className="text-[13px] text-foreground/70 flex-1">{admin.displayName} <span className="text-foreground/40">@{admin.username}</span></span>
                      <button onClick={() => removeAdmin(admin.clerkUserId)}
                        className="p-1 rounded text-foreground/30 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {firm.admins.length === 0 && (
                <p className="text-[12px] text-foreground/40 mb-3">No shared admins yet. Add team members by username.</p>
              )}
              {adminError && <p className="text-[12px] text-red-500 mb-2">{adminError}</p>}
              <div className="flex gap-2">
                <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden flex-1 focus-within:ring-2 focus-within:ring-foreground/20">
                  <span className="pl-3 text-[13px] text-foreground/40">@</span>
                  <input value={adminInput} onChange={e => setAdminInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAdmin(); } }}
                    placeholder="username"
                    className="flex-1 bg-transparent px-2 py-2 text-[13px] font-mono focus:outline-none" />
                </div>
                <button onClick={addAdmin} disabled={addingAdmin || !adminInput.trim()}
                  className="flex items-center gap-1 px-3 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0">
                  <UserPlus className="h-3.5 w-3.5" /> {addingAdmin ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Admin-only view of admins (non-owner) */}
          {!isOwner && (
            <div className="px-5 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Your role</p>
              <p className="text-[13px] text-foreground/60">You are an admin of this firm. Contact the owner to make changes to admin access.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Firms() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const { data: firms = [], isLoading } = useFirms(isLoaded && !!isSignedIn);
  const [creating, setCreating] = useState(false);
  const [apiError, setApiError] = useState("");

  // Create form state
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newBio, setNewBio] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim()) return;
    setCreateSaving(true);
    setApiError("");
    const res = await fetch(`${basePath}/api/firms`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), username: newUsername.trim(), bio: newBio.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setApiError((j as any).error ?? "Failed to create firm");
    } else {
      await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
      setCreating(false);
      setNewName(""); setNewUsername(""); setNewBio("");
    }
    setCreateSaving(false);
  }

  async function handleDelete(firmUsername: string, firmName: string) {
    if (!confirm(`Delete "${firmName}"? This cannot be undone.`)) return;
    await fetch(`${basePath}/api/firms/${firmUsername}`, { method: "DELETE", credentials: "include" });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
  }

  if (!isLoaded || isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-16 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] text-foreground/50">
          <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign in to manage firms</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My firms</h1>
            <p className="text-[13px] text-foreground/40 mt-1">Separate publishing identities for organizations</p>
          </div>
          {!creating && (
            <button onClick={() => { setCreating(true); setApiError(""); }}
              className="flex items-center gap-1.5 bg-foreground text-background px-4 py-2 rounded-full text-[13px] font-medium hover:opacity-80 transition-opacity shrink-0">
              <Plus className="h-3.5 w-3.5" /> New firm
            </button>
          )}
        </div>

        {apiError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl mb-5">{apiError}</div>
        )}

        {/* Create form */}
        {creating && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] space-y-4 mb-5">
            <p className="text-[14px] font-semibold">Create new firm</p>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Firm name *</label>
              <input value={newName} onChange={e => { setNewName(e.target.value); setNewUsername(slugify(e.target.value)); }}
                placeholder="Acme Legal Partners"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Username *</label>
              <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
                <span className="pl-4 text-[14px] text-foreground/40">@</span>
                <input value={newUsername} onChange={e => setNewUsername(slugify(e.target.value))} placeholder="acme-legal"
                  className="flex-1 bg-transparent px-2 py-2.5 text-[14px] font-mono focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Bio</label>
              <input value={newBio} onChange={e => setNewBio(e.target.value)} placeholder="What does this firm specialize in?"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={createSaving || !newName.trim() || !newUsername.trim()}
                className="bg-foreground text-background px-5 py-2 rounded-full text-[13px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                {createSaving ? "Creating…" : "Create firm"}
              </button>
              <button type="button" onClick={() => { setCreating(false); setApiError(""); }}
                className="px-5 py-2 rounded-full text-[13px] text-foreground/60 hover:bg-[#f5f5f7] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {firms.length === 0 && !creating && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-foreground/30" />
            </div>
            <p className="text-[15px] font-medium text-foreground/60 mb-1">No firms yet</p>
            <p className="text-[13px] text-foreground/40 max-w-xs mx-auto">
              Create a firm identity to publish prompts on behalf of an organization.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {firms.map(firm => {
            const isOwner = firm.admins !== undefined
              ? !firm.adminClerkUserIds.includes(userId ?? "")
              : true; // fallback
            return (
              <FirmCard
                key={firm.id}
                firm={firm}
                isOwner={isOwner}
                onUpdate={() => {}}
                onDelete={() => handleDelete(firm.username, firm.orgName ?? firm.displayName)}
              />
            );
          })}
        </div>

        {firms.length > 0 && (
          <p className="text-[12px] text-foreground/30 mt-6 text-center">
            Firms appear as publishing options when you create a prompt.
          </p>
        )}
      </div>
    </Layout>
  );
}
