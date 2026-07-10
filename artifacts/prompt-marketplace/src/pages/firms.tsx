import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Firm = {
  id: number;
  username: string;
  displayName: string;
  orgName: string | null;
  bio: string | null;
  categories: string[];
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

function FirmForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: { name: string; username: string; bio: string }) => Promise<void>;
  onCancel: () => void;
  initial?: { name: string; username: string; bio: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleSave() {
    if (!name.trim() || (!isEdit && !username.trim())) return;
    setSaving(true);
    await onSave({ name: name.trim(), username: username.trim(), bio: bio.trim() });
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] space-y-4">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Firm name *</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!isEdit) setUsername(slugify(e.target.value));
          }}
          placeholder="Acme Legal Partners"
          className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      </div>

      {!isEdit && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Username *</label>
          <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
            <span className="pl-4 text-[14px] text-foreground/40">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(slugify(e.target.value))}
              placeholder="acme-legal"
              className="flex-1 bg-transparent px-2 py-2.5 text-[14px] font-mono focus:outline-none"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-1.5">Bio</label>
        <input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="What does this firm specialize in?"
          className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || (!isEdit && !username.trim())}
          className="bg-foreground text-background px-5 py-2 rounded-full text-[13px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create firm"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-full text-[13px] text-foreground/60 hover:bg-[#f5f5f7] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Firms() {
  const { isSignedIn, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const { data: firms = [], isLoading } = useFirms(isLoaded && !!isSignedIn);
  const [creating, setCreating] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");

  async function handleCreate(data: { name: string; username: string; bio: string }) {
    setApiError("");
    const res = await fetch(`${basePath}/api/firms`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setApiError((j as any).error ?? "Failed to create firm");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    setCreating(false);
  }

  async function handleEdit(firmUsername: string, data: { name: string; bio: string }) {
    setApiError("");
    const res = await fetch(`${basePath}/api/firms/${firmUsername}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setApiError((j as any).error ?? "Failed to update firm");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    setEditingUsername(null);
  }

  async function handleDelete(firmUsername: string, firmName: string) {
    if (!confirm(`Delete "${firmName}"? This cannot be undone.`)) return;
    await fetch(`${basePath}/api/firms/${firmUsername}`, {
      method: "DELETE",
      credentials: "include",
    });
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

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My firms</h1>
            <p className="text-[13px] text-foreground/40 mt-1">Separate publishing identities for organizations</p>
          </div>
          {!creating && (
            <button
              onClick={() => { setCreating(true); setEditingUsername(null); setApiError(""); }}
              className="flex items-center gap-1.5 bg-foreground text-background px-4 py-2 rounded-full text-[13px] font-medium hover:opacity-80 transition-opacity shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> New firm
            </button>
          )}
        </div>

        {apiError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl mb-5">{apiError}</div>
        )}

        {/* Create form */}
        {creating && (
          <div className="mb-5">
            <FirmForm
              onSave={handleCreate}
              onCancel={() => { setCreating(false); setApiError(""); }}
            />
          </div>
        )}

        {/* Empty state */}
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

        {/* Firms list */}
        <div className="space-y-4">
          {firms.map(firm => (
            <div key={firm.id}>
              {editingUsername === firm.username ? (
                <FirmForm
                  initial={{ name: firm.orgName ?? firm.displayName, username: firm.username, bio: firm.bio ?? "" }}
                  onSave={(data) => handleEdit(firm.username, data)}
                  onCancel={() => { setEditingUsername(null); setApiError(""); }}
                />
              ) : (
                <div className="bg-white rounded-2xl px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 text-[16px]"
                    style={{ background: "var(--orange)" }}
                  >
                    {(firm.orgName ?? firm.displayName)[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{firm.orgName ?? firm.displayName}</p>
                    <p className="text-[12px] text-foreground/40">@{firm.username}</p>
                    {firm.bio && (
                      <p className="text-[12px] text-foreground/50 mt-0.5 truncate">{firm.bio}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/profile/${firm.username}`}
                      className="px-3 py-1.5 rounded-lg text-[12px] text-foreground/50 hover:bg-[#f5f5f7] hover:text-foreground transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => { setEditingUsername(firm.username); setCreating(false); setApiError(""); }}
                      className="p-2 rounded-lg text-foreground/40 hover:bg-[#f5f5f7] hover:text-foreground transition-colors"
                      title="Edit firm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(firm.username, firm.orgName ?? firm.displayName)}
                      className="p-2 rounded-lg text-foreground/30 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Delete firm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
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
