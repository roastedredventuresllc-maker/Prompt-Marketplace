import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const ALL_CATEGORIES = [
  "Finance", "Law", "Technology", "Writing", "Marketing",
  "Data & Analytics", "Design", "Research", "Business", "Education",
];

type ProfileData = {
  username: string;
  displayName: string;
  bio: string | null;
  categories: string[];
  orgType: string;
  orgName: string | null;
  avatarUrl: string | null;
  ownerClerkUserId?: string | null;
  promptPriceCents: number;
  collectionPriceCents: number;
};

function useProfile(username: string, enabled: boolean) {
  return useQuery<ProfileData>({
    queryKey: ["profile-edit", username],
    queryFn: async () => {
      const url = username === "me"
        ? `${basePath}/api/users/me`
        : `${basePath}/api/users/${username}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled,
  });
}

async function uploadAvatar(file: File): Promise<string> {
  const urlRes = await fetch(`${basePath}/api/storage/uploads/request-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Upload failed");
  return `${basePath}/api/storage${objectPath}`;
}

function centsToStr(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
function strToCents(val: string): number | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function EditProfile() {
  const { username = "me" } = useParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useProfile(username, isLoaded && !!isSignedIn);
  const isFirmProfile = !!(profile as any)?.ownerClerkUserId;

  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    orgName: "",
    categories: [] as string[],
    username: "",
    avatarUrl: null as string | null,
  });
  const [promptPrice, setPromptPrice] = useState("5");
  const [collectionPrice, setCollectionPrice] = useState("100");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        orgName: profile.orgName ?? "",
        categories: profile.categories ?? [],
        username: profile.username ?? "",
        avatarUrl: profile.avatarUrl ?? null,
      });
      setPromptPrice(centsToStr(profile.promptPriceCents ?? 500));
      setCollectionPrice(centsToStr(profile.collectionPriceCents ?? 10000));
    }
  }, [profile]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const nameField = isFirmProfile ? form.orgName : form.displayName;
    if (!nameField.trim()) return;
    setSaveState("saving");
    setSaveError("");

    try {
      let newAvatarUrl: string | null = null;
      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(avatarFile);
      }

      const promptPriceCents = strToCents(promptPrice);
      const collectionPriceCents = strToCents(collectionPrice);

      const targetUsername = username === "me" ? profile?.username : username;
      const body: Record<string, any> = {
        displayName: isFirmProfile ? (form.orgName.trim()) : form.displayName.trim(),
        bio: form.bio.trim() || null,
        orgName: isFirmProfile ? form.orgName.trim() : null,
        categories: form.categories,
        ...(newAvatarUrl ? { avatarUrl: newAvatarUrl } : {}),
        ...(form.username !== profile?.username ? { username: form.username } : {}),
        ...(promptPriceCents ? { promptPriceCents } : {}),
        ...(collectionPriceCents ? { collectionPriceCents } : {}),
      };

      const res = await fetch(`${basePath}/api/users/${targetUsername}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any).error ?? "Failed to save");
      }

      const updated = await res.json();
      queryClient.invalidateQueries({ queryKey: ["profile-edit", username] });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users", "me", "username"] });
      queryClient.invalidateQueries({ queryKey: ["users", "me", "info"] });
      queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
      setAvatarFile(null);
      setAvatarPreview(null);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);

      if (updated.username && updated.username !== targetUsername) {
        setLocation(`/profile/edit/${updated.username}`);
      }
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to save");
      setSaveState("error");
    }
  }

  function toggleCategory(cat: string) {
    setForm(p => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter(c => c !== cat)
        : [...p.categories, cat],
    }));
  }

  const backHref = username === "me"
    ? (profile ? `/profile/${profile.username}` : "/")
    : `/profile/${username}`;

  const currentAvatar = avatarPreview ?? form.avatarUrl;

  if (!isLoaded || isLoading) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-6 py-16 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-6 py-12">
        <Link href={backHref} className="flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground mb-8 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {isFirmProfile ? "Edit firm" : "Edit profile"}
          </h1>
          {profile?.username && (
            <p className="text-[13px] text-foreground/40 mt-1">@{profile.username}</p>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-5">

          {/* Avatar */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Photo</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="relative w-16 h-16 rounded-2xl overflow-hidden group shrink-0">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: isFirmProfile ? "var(--orange)" : "rgba(0,0,0,0.10)", color: isFirmProfile ? "white" : "rgba(0,0,0,0.3)" }}>
                    {(form.orgName || form.displayName || "?")[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </button>
              <div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors">
                  {currentAvatar ? "Change photo" : "Upload photo"}
                </button>
                <p className="text-[11px] text-foreground/40 mt-0.5">JPG, PNG or WebP. Max 5MB.</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">
              {isFirmProfile ? "Firm name" : "Display name"}
            </label>
            {isFirmProfile ? (
              <input type="text" value={form.orgName}
                onChange={(e) => setForm(p => ({ ...p, orgName: e.target.value, displayName: e.target.value }))}
                placeholder="Your firm's public name"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            ) : (
              <input type="text" value={form.displayName}
                onChange={(e) => setForm(p => ({ ...p, displayName: e.target.value }))}
                placeholder="Your name as shown on prompts"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Username (handle)</label>
            <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="pl-4 text-[14px] text-foreground/40">@</span>
              <input type="text" value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                placeholder="yourhandle"
                className="flex-1 bg-transparent px-2 py-3 text-[14px] font-mono focus:outline-none" />
            </div>
            <p className="text-[11px] text-foreground/40 mt-1">Changing your handle will break existing links to your profile.</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
              placeholder="A short description of what you do" rows={3}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none" />
          </div>

          {/* Specialities */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Specialities</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                    form.categories.includes(cat)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground/60 border-black/[0.08] hover:border-black/20 hover:text-foreground"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing — only for personal profiles (firms use their own pricing in My Firms) */}
          {!isFirmProfile && (
            <div className="pt-2 border-t border-black/[0.06]">
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-3">Pricing</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] text-foreground/60 mb-1.5 font-medium">Price per prompt</p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 text-[14px]">$</span>
                    <input type="number" min="0.01" step="0.01" value={promptPrice}
                      onChange={e => setPromptPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 bg-[#f5f5f7] rounded-xl text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                  </div>
                  <p className="text-[11px] text-foreground/35 mt-1">Charged per prompt</p>
                </div>
                <div>
                  <p className="text-[12px] text-foreground/60 mb-1.5 font-medium">Price per collection</p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 text-[14px]">$</span>
                    <input type="number" min="0.01" step="0.01" value={collectionPrice}
                      onChange={e => setCollectionPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 bg-[#f5f5f7] rounded-xl text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                  </div>
                  <p className="text-[11px] text-foreground/35 mt-1">Charged per collection</p>
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="pt-2 flex items-center gap-3">
            <button type="submit" disabled={saveState === "saving"}
              className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity disabled:opacity-50">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveState === "saving" ? "Saving…" : "Save changes"}
            </button>
            {saveState === "saved" && (
              <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--orange)" }}>
                <CheckCircle className="h-4 w-4" /> Saved
              </div>
            )}
            {saveState === "error" && (
              <div className="flex items-center gap-1.5 text-[13px] text-red-500">
                <AlertCircle className="h-4 w-4" /> {saveError || "Failed to save"}
              </div>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
