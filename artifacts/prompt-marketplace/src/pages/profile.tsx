import { useParams, Link, useLocation } from "wouter";
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
import {
  Heart, Calendar, User, BookOpen, Copy, Check, Pencil, Plus,
  Users, X, UserPlus, Save, Building2, Trash2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AddToLibraryMenu } from "@/components/add-to-library-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useMyInfo() {
  const { isSignedIn, userId } = useAuth();
  return useQuery<{ username: string | null; clerkUserId: string | null }>({
    queryKey: ["users", "me", "info"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/users/me`, { credentials: "include" });
      if (!res.ok) return { username: null, clerkUserId: null };
      const d = await res.json();
      return { username: d.username ?? null, clerkUserId: userId ?? null };
    },
    enabled: !!isSignedIn,
    retry: false,
  });
}

function useFirmDetails(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["firms", "mine"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/firms/mine`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
    select: (firms: any[]) => firms.find((f: any) => f.username === username) ?? null,
  });
}

function categoryAccentColor(_catName?: string | null): string {
  return "var(--orange)";
}

type LibraryMeta = { id: number; name: string; promptCount: number };
type AdminEntry = { clerkUserId: string; username: string; displayName: string };

/* ── Team Tab ─────────────────────────────────────────────────────────── */
function TeamTab({
  username,
  isOwner,
  ownerClerkUserId,
}: {
  username: string;
  isOwner: boolean;
  ownerClerkUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const [adminInput, setAdminInput] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const { data: firmData } = useFirmDetails(username, true);
  const admins: AdminEntry[] = firmData?.admins ?? [];

  async function addAdmin() {
    if (!adminInput.trim()) return;
    setAddingAdmin(true);
    setAdminError("");
    const res = await fetch(`${basePath}/api/firms/${username}/admins`, {
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
    await fetch(`${basePath}/api/firms/${username}/admins/${encodeURIComponent(clerkId)}`, {
      method: "DELETE", credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] divide-y divide-black/[0.05] overflow-hidden">

        {/* Owner row */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/35 mb-3">Owner</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "var(--orange)" }}>
              {firmData?.displayName?.[0] ?? "?"}
            </div>
            <div>
              <p className="text-[14px] font-semibold">{firmData?.displayName ?? "—"}</p>
              <p className="text-[12px] text-foreground/40">@{username}</p>
            </div>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded font-bold text-white" style={{ background: "var(--orange)" }}>OWNER</span>
          </div>
        </div>

        {/* Admins list */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/35 mb-3">
            Admins {admins.length > 0 && <span className="normal-case font-normal">· {admins.length}</span>}
          </p>
          {admins.length === 0 ? (
            <p className="text-[13px] text-foreground/40">
              {isOwner ? "No admins yet. Add team members below." : "No additional admins."}
            </p>
          ) : (
            <div className="space-y-2.5">
              {admins.map(admin => (
                <div key={admin.clerkUserId} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-foreground/[0.07] flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {admin.displayName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">{admin.displayName}</span>
                    <span className="text-[12px] text-foreground/40 ml-1.5">@{admin.username}</span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => removeAdmin(admin.clerkUserId)}
                      className="p-1.5 rounded-lg text-foreground/30 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add admin form — owner only */}
        {isOwner && (
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/35 mb-3">Add team member</p>
            {adminError && <p className="text-[12px] text-red-500 mb-2">{adminError}</p>}
            <div className="flex gap-2">
              <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden flex-1 focus-within:ring-2 focus-within:ring-foreground/20">
                <span className="pl-3 text-[13px] text-foreground/40">@</span>
                <input
                  value={adminInput}
                  onChange={e => setAdminInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAdmin(); } }}
                  placeholder="username"
                  className="flex-1 bg-transparent px-2 py-2.5 text-[13px] font-mono focus:outline-none"
                />
              </div>
              <button
                onClick={addAdmin}
                disabled={addingAdmin || !adminInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-foreground text-background rounded-xl text-[12px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {addingAdmin ? "Adding…" : "Add"}
              </button>
            </div>
            <p className="text-[11px] text-foreground/35 mt-2">
              Admins can edit this firm's profile and manage prompts, but cannot add or remove other admins.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Profile header edit form for firms ──────────────────────────────── */
function FirmEditPanel({
  profile,
  username,
  onSave,
  onCancel,
}: {
  profile: any;
  username: string;
  onSave: (updated: any) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState((profile.orgName ?? profile.displayName) as string);
  const [bio, setBio] = useState((profile.bio ?? "") as string);
  const [promptPrice, setPromptPrice] = useState(((profile.promptPriceCents ?? 500) / 100).toFixed(2));
  const [collectionPrice, setCollectionPrice] = useState(((profile.collectionPriceCents ?? 10000) / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const promptPriceCents = Math.round(parseFloat(promptPrice.replace(/[^0-9.]/g, "")) * 100);
    const collectionPriceCents = Math.round(parseFloat(collectionPrice.replace(/[^0-9.]/g, "")) * 100);
    const res = await fetch(`${basePath}/api/users/${username}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: name.trim(), orgName: name.trim(), bio: bio.trim() || null,
        ...(promptPriceCents > 0 ? { promptPriceCents } : {}),
        ...(collectionPriceCents > 0 ? { collectionPriceCents } : {}),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as any).error ?? "Failed to save");
      setSaving(false);
      return;
    }
    const updated = await res.json();
    await queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(username) });
    await queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
    setSaving(false);
    onSave(updated);
  }

  return (
    <form onSubmit={handleSave} className="mt-5 bg-[#f5f5f7] rounded-2xl p-5 space-y-4 border border-black/[0.06]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">Firm name</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            className="w-full bg-white rounded-xl px-3.5 py-2.5 text-[14px] border border-black/[0.07] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">Bio</label>
          <input value={bio} onChange={e => setBio(e.target.value)} placeholder="Short description"
            className="w-full bg-white rounded-xl px-3.5 py-2.5 text-[14px] border border-black/[0.07] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">Prompt price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
            <input type="number" min="0.01" step="0.01" value={promptPrice} onChange={e => setPromptPrice(e.target.value)}
              className="w-full pl-6 pr-3 py-2.5 bg-white rounded-xl text-[13px] border border-black/[0.07] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">Collection price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-[13px]">$</span>
            <input type="number" min="0.01" step="0.01" value={collectionPrice} onChange={e => setCollectionPrice(e.target.value)}
              className="w-full pl-6 pr-3 py-2.5 bg-white rounded-xl text-[13px] border border-black/[0.07] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
          </div>
        </div>
      </div>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 bg-foreground text-background px-5 py-2 rounded-full text-[13px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 rounded-full text-[13px] text-foreground/60 hover:bg-white transition-colors border border-black/[0.08]">
          Cancel
        </button>
        <Link
          href={`/profile/edit/${username}`}
          className="ml-auto px-4 py-2 rounded-full text-[12px] text-foreground/40 hover:text-foreground/70 transition-colors"
        >
          More options →
        </Link>
      </div>
    </form>
  );
}

/* ── Main Profile page ───────────────────────────────────────────────── */

export default function Profile() {
  const { username } = useParams();
  const [, setLocation] = useLocation();
  const safeUsername = username || "me";
  const [activeTab, setActiveTab] = useState<"prompts" | "libraries" | "team">("prompts");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeletePrompt, setConfirmDeletePrompt] = useState<number | null>(null);
  const [confirmDeleteLibrary, setConfirmDeleteLibrary] = useState<number | null>(null);
  const [deletingPrompt, setDeletingPrompt] = useState<number | null>(null);
  const [deletingLibrary, setDeletingLibrary] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: myInfo } = useMyInfo();
  const { userId } = useAuth();

  const { data: profile, isLoading: profileLoading, isError } = useGetUserProfile(safeUsername, {
    query: { enabled: !!safeUsername, queryKey: getGetUserProfileQueryKey(safeUsername) },
  });

  const listPromptsParams = { username: safeUsername, limit: 48 };
  const { data: promptsData, isLoading: promptsLoading } = useListPrompts(
    listPromptsParams,
    { query: { enabled: activeTab === "prompts", queryKey: getListPromptsQueryKey(listPromptsParams) } }
  );

  const { data: librariesData, isLoading: libLoading } = useGetUserLibraries(safeUsername, {
    query: { enabled: activeTab === "libraries" || activeTab === "prompts", queryKey: getGetUserLibrariesQueryKey(safeUsername) },
  });

  const { data: libraryDetail } = useQuery<{ prompts: any[] } | null>({
    queryKey: ["library-detail-prompts", selectedLibraryId],
    queryFn: async () => {
      if (!selectedLibraryId) return null;
      const res = await fetch(`${basePath}/api/libraries/${selectedLibraryId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: selectedLibraryId !== null,
  });

  function handleCopy(e: React.MouseEvent, content: string, id: number) {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDeletePrompt(e: React.MouseEvent, promptId: number) {
    e.preventDefault(); e.stopPropagation();
    if (confirmDeletePrompt !== promptId) {
      setConfirmDeletePrompt(promptId);
      setTimeout(() => setConfirmDeletePrompt(null), 4000);
      return;
    }
    setDeletingPrompt(promptId);
    await fetch(`${basePath}/api/prompts/${promptId}`, { method: "DELETE", credentials: "include" });
    await queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(listPromptsParams) });
    setDeletingPrompt(null);
    setConfirmDeletePrompt(null);
  }

  async function handleDeleteLibrary(e: React.MouseEvent, libraryId: number) {
    e.preventDefault(); e.stopPropagation();
    if (confirmDeleteLibrary !== libraryId) {
      setConfirmDeleteLibrary(libraryId);
      setTimeout(() => setConfirmDeleteLibrary(null), 4000);
      return;
    }
    setDeletingLibrary(libraryId);
    await fetch(`${basePath}/api/libraries/${libraryId}`, { method: "DELETE", credentials: "include" });
    await queryClient.invalidateQueries({ queryKey: getGetUserLibrariesQueryKey(safeUsername) });
    setDeletingLibrary(null);
    setConfirmDeleteLibrary(null);
  }

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    setCollectionSaving(true);
    try {
      const res = await fetch(`${basePath}/api/libraries`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim(), authorUsername: safeUsername, isPublic: true }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: getGetUserLibrariesQueryKey(safeUsername) });
        setNewCollectionName("");
        setCreatingCollection(false);
        setActiveTab("libraries");
      }
    } finally {
      setCollectionSaving(false);
    }
  }

  if (profileLoading) {
    return (
      <Layout>
        <div className="bg-[#F5F5F7] min-h-full">
          <div className="bg-white border-b border-black/[0.05] px-6 py-14">
            <div className="max-w-5xl mx-auto flex items-center gap-6">
              <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48 rounded-lg" />
                <Skeleton className="h-4 w-32 rounded-lg" />
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
          <Link href="/explore" className="text-[14px] text-foreground/50 hover:text-foreground">Back to explore</Link>
        </div>
      </Layout>
    );
  }

  const isFirm = (profile as any).orgType === "firm";
  const orgName = (profile as any).orgName as string | null;
  const displayName = orgName ?? profile.displayName;
  const profileOwnerClerkUserId = (profile as any).ownerClerkUserId as string | null;
  const profileAdminClerkUserIds: string[] = (profile as any).adminClerkUserIds ?? [];

  // Permission levels
  const isOwner = !!(profileOwnerClerkUserId && profileOwnerClerkUserId === userId);
  const isAdmin = !isOwner && profileAdminClerkUserIds.includes(userId ?? "");
  const canEdit = myInfo?.username === safeUsername || isOwner || isAdmin;

  const allPrompts = promptsData?.prompts ?? [];
  const displayedPrompts = selectedLibraryId && libraryDetail ? libraryDetail.prompts : allPrompts;
  const libraryOptions: LibraryMeta[] = (librariesData ?? []).map((l: any) => ({
    id: l.id, name: l.name, promptCount: l.promptCount ?? 0,
  }));

  const tabs = [
    { key: "prompts" as const, label: "Prompts" },
    { key: "libraries" as const, label: "Collections" },
    ...(isFirm && canEdit ? [{ key: "team" as const, label: "Team" }] : []),
  ];

  return (
    <Layout>
      <div className="bg-[#F5F5F7] min-h-full">

        {/* ── Profile header ─────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.05] px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">

              {/* Avatar */}
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0"
                  style={isFirm
                    ? { background: "var(--orange)", color: "white" }
                    : { background: "rgba(0,0,0,0.10)", color: "rgba(0,0,0,0.3)" }}
                >
                  {displayName.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                {/* Name + badges */}
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-1">
                  <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                  {isFirm && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white" style={{ background: "var(--orange)" }}>FIRM</span>
                  )}
                  {isAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold border text-foreground/60 border-foreground/20">ADMIN</span>
                  )}
                </div>
                <p className="text-[14px] text-foreground/40 mb-3">@{profile.username}</p>

                {!isEditing && profile.bio && (
                  <p className="text-[15px] text-foreground/60 leading-relaxed max-w-2xl mb-4">{profile.bio}</p>
                )}

                {/* Action buttons */}
                {!isEditing && (
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                    {isFirm && canEdit ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#F5F5F7] text-foreground/60 hover:bg-[#eaeaea] hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit firm
                      </button>
                    ) : !isFirm && canEdit ? (
                      <Link
                        href={`/profile/edit/${safeUsername}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#F5F5F7] text-foreground/60 hover:bg-[#eaeaea] hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit profile
                      </Link>
                    ) : null}
                  </div>
                )}

                {/* Inline firm edit form */}
                {isFirm && canEdit && isEditing && (
                  <FirmEditPanel
                    profile={profile}
                    username={safeUsername}
                    onSave={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                  />
                )}

                {/* Stats */}
                {!isEditing && (
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
                    {isFirm && isOwner && (
                      <Link
                        href="/firms"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] text-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5" /> Manage firms
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="bg-white border-b border-black/[0.06] px-6">
          <div className="max-w-5xl mx-auto flex items-center gap-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedLibraryId(null); setCreatingCollection(false); setIsEditing(false); }}
                className="py-3.5 text-[14px] font-medium capitalize transition-all border-b-2 flex items-center gap-1.5"
                style={activeTab === tab.key
                  ? { borderColor: "var(--orange)", color: "var(--orange)" }
                  : { borderColor: "transparent", color: "rgba(0,0,0,0.45)" }}
                data-testid={`tab-${tab.key}`}
              >
                {tab.key === "team" && <Users className="h-3.5 w-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Prompts tab */}
          {activeTab === "prompts" && (
            <>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                {libraryOptions.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <button
                      onClick={() => setSelectedLibraryId(null)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                        selectedLibraryId === null
                          ? "bg-foreground text-background border-foreground"
                          : "border-black/[0.08] text-foreground/60 hover:border-black/20"
                      }`}
                    >
                      All
                    </button>
                    {libraryOptions.map(lib => (
                      <button
                        key={lib.id}
                        onClick={() => setSelectedLibraryId(lib.id)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                          selectedLibraryId === lib.id
                            ? "text-white border-transparent"
                            : "border-black/[0.08] text-foreground/60 hover:border-black/20"
                        }`}
                        style={selectedLibraryId === lib.id ? { background: "var(--orange)", borderColor: "var(--orange)" } : {}}
                      >
                        {lib.name}
                      </button>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <Link
                    href="/create"
                    className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-full text-[12px] font-medium bg-foreground text-background hover:opacity-80 transition-opacity shrink-0"
                  >
                    <Plus className="h-3 w-3" /> New prompt
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {promptsLoading
                  ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
                  : displayedPrompts.length > 0
                  ? displayedPrompts.map((prompt: any) => {
                      const accent = categoryAccentColor(prompt.categoryName);
                      const isPromptOwner = canEdit && (myInfo?.username === prompt.authorUsername || myInfo?.username === safeUsername);
                      const isConfirmingDelete = confirmDeletePrompt === prompt.id;
                      const isDeletingThis = deletingPrompt === prompt.id;
                      return (
                        <Link key={prompt.id} href={`/prompt/${prompt.id}`} className="group block" data-testid={`profile-prompt-${prompt.id}`}>
                          <div className="h-full bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide" style={{ background: `${accent}12`, color: accent }}>
                                {prompt.subcategoryName ?? prompt.categoryName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isPromptOwner && (
                                  <Link href={`/prompt/${prompt.id}/edit`} onClick={e => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-[#f5f5f7] text-foreground/40 hover:text-foreground" title="Edit">
                                    <Pencil className="h-3 w-3" />
                                  </Link>
                                )}
                                {isPromptOwner && (
                                  <button
                                    onClick={e => handleDeletePrompt(e, prompt.id)}
                                    disabled={isDeletingThis}
                                    title={isConfirmingDelete ? "Click again to confirm" : "Delete"}
                                    className={`opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg text-[10px] font-medium ${
                                      isConfirmingDelete
                                        ? "!opacity-100 bg-red-500 text-white px-2"
                                        : "hover:bg-red-50 text-foreground/40 hover:text-red-500"
                                    }`}
                                  >
                                    {isDeletingThis ? "…" : isConfirmingDelete ? "Confirm?" : <Trash2 className="h-3 w-3" />}
                                  </button>
                                )}
                                <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: "var(--orange)" }}>
                                  <Heart className="h-3 w-3" fill={prompt.saveCount > 0 ? "currentColor" : "none"} strokeWidth={prompt.saveCount > 0 ? 0 : 1.5} />
                                  {prompt.saveCount}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-foreground/70 transition-colors line-clamp-2">{prompt.title}</h3>
                              <p className="text-[13px] text-foreground/50 line-clamp-2 leading-relaxed">{prompt.description}</p>
                            </div>
                            <div className="pt-3 border-t border-black/[0.04]">
                              {/* Author row */}
                              <button
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setLocation(`/profile/${prompt.authorUsername}`); }}
                                className="flex items-center gap-2 mb-2.5 hover:opacity-70 transition-opacity"
                              >
                                <div className="w-5 h-5 rounded-full bg-foreground/[0.07] flex items-center justify-center text-[9px] font-semibold shrink-0">
                                  {(prompt.authorDisplayName ?? "?")[0]}
                                </div>
                                <span className="text-[12px] font-medium text-foreground/50 truncate">{prompt.authorDisplayName}</span>
                              </button>
                              {/* Action row */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={e => handleCopy(e, prompt.content, prompt.id)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-foreground/40 hover:text-foreground/70 font-medium transition-all"
                                >
                                  {copiedId === prompt.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                  {copiedId === prompt.id ? "Copied" : "Copy"}
                                </button>
                                <div onClick={e => e.stopPropagation()} style={{ zIndex: 20 }}>
                                  <AddToLibraryMenu promptId={prompt.id} variant="icon" />
                                </div>
                              </div>
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
                      <h3 className="font-semibold mb-1">
                        {selectedLibraryId ? "No prompts in this collection" : "No prompts yet"}
                      </h3>
                      <p className="text-[14px] text-foreground/50">
                        {selectedLibraryId ? "Add prompts from a prompt page." : "This creator has not published any prompts."}
                      </p>
                      {canEdit && !selectedLibraryId && (
                        <Link href="/create" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full text-[13px] font-medium bg-foreground text-background hover:opacity-80 transition-opacity">
                          <Plus className="h-3.5 w-3.5" /> Create first prompt
                        </Link>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}

          {/* Libraries tab */}
          {activeTab === "libraries" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[15px] font-semibold text-foreground/60">Collections</h2>
                {canEdit && (
                  <button
                    onClick={() => setCreatingCollection(c => !c)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-foreground text-background hover:opacity-80 transition-opacity"
                  >
                    <Plus className="h-3 w-3" /> New collection
                  </button>
                )}
              </div>

              {creatingCollection && (
                <form onSubmit={handleCreateCollection} className="mb-6 flex gap-3 items-center bg-white rounded-2xl px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04]">
                  <input
                    value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                    placeholder="Collection name…" autoFocus
                    className="flex-1 bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <button type="submit" disabled={collectionSaving || !newCollectionName.trim()}
                    className="px-4 py-2.5 rounded-xl bg-foreground text-background text-[13px] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0">
                    {collectionSaving ? "Creating…" : "Create"}
                  </button>
                  <button type="button" onClick={() => setCreatingCollection(false)}
                    className="px-3 py-2.5 rounded-xl text-[13px] text-foreground/50 hover:bg-[#f5f5f7] transition-colors">
                    Cancel
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {libLoading
                  ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
                  : librariesData?.length
                  ? librariesData.map((lib: any) => {
                      const accent = { color: "var(--orange)", subtle: "var(--orange-subtle)" };
                      const previewTitles: string[] = lib.previewTitles ?? [];
                      const libPrice = lib.priceCents;
                      const isConfirmingLibDelete = confirmDeleteLibrary === lib.id;
                      const isDeletingLib = deletingLibrary === lib.id;
                      return (
                        <Link key={lib.id} href={`/library/${lib.id}`} className="group block" data-testid={`library-card-${lib.id}`}>
                          <div
                            className="h-full bg-white rounded-2xl p-6 flex flex-col gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_36px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/[0.05]"
                            style={{ borderTop: `3px solid ${accent.color}` }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent.subtle }}>
                                <BookOpen className="h-4 w-4" style={{ color: accent.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-[16px] leading-tight group-hover:opacity-70 transition-opacity mb-1">{lib.name}</h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: accent.subtle, color: accent.color }}>
                                    {lib.promptCount} {lib.promptCount === 1 ? "prompt" : "prompts"}
                                  </span>
                                  {libPrice && (
                                    <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f5f7] text-foreground/50">
                                      ${(libPrice / 100).toFixed(libPrice % 100 === 0 ? 0 : 2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Delete library button */}
                              {canEdit && (
                                <button
                                  onClick={e => handleDeleteLibrary(e, lib.id)}
                                  disabled={isDeletingLib}
                                  className={`opacity-0 group-hover:opacity-100 shrink-0 transition-all rounded-lg text-[10px] font-medium ${
                                    isConfirmingLibDelete
                                      ? "!opacity-100 bg-red-500 text-white px-2 py-1"
                                      : "p-1.5 hover:bg-red-50 text-foreground/30 hover:text-red-500"
                                  }`}
                                  title={isConfirmingLibDelete ? "Click again to confirm delete" : "Delete collection"}
                                >
                                  {isDeletingLib ? "…" : isConfirmingLibDelete ? "Confirm?" : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                            {lib.description && (
                              <p className="text-[13px] text-foreground/60 leading-relaxed">{lib.description}</p>
                            )}
                            {previewTitles.length > 0 && (
                              <ul className="space-y-1.5">
                                {previewTitles.map((t: string) => (
                                  <li key={t} className="flex items-center gap-2 text-[13px] text-foreground/55">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent.color }} />
                                    <span className="line-clamp-1">{t}</span>
                                  </li>
                                ))}
                                {lib.promptCount > previewTitles.length && (
                                  <li className="text-[12px] pl-3.5" style={{ color: accent.color }}>+{lib.promptCount - previewTitles.length} more</li>
                                )}
                              </ul>
                            )}
                            <div className="mt-auto pt-4 border-t border-black/[0.05] flex items-center justify-between">
                              <span className="text-[12px] text-foreground/35">
                                {new Date(lib.updatedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                              </span>
                              <span className="text-[13px] font-medium group-hover:underline" style={{ color: accent.color }}>View →</span>
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
                      <h3 className="font-semibold mb-1">No collections yet</h3>
                      <p className="text-[14px] text-foreground/50">Group prompts into collections to share curated sets.</p>
                      {canEdit && (
                        <button onClick={() => setCreatingCollection(true)}
                          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full text-[13px] font-medium bg-foreground text-background hover:opacity-80 transition-opacity">
                          <Plus className="h-3.5 w-3.5" /> Create first collection
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}

          {/* Team tab */}
          {activeTab === "team" && isFirm && canEdit && (
            <TeamTab
              username={safeUsername}
              isOwner={isOwner}
              ownerClerkUserId={profileOwnerClerkUserId}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
