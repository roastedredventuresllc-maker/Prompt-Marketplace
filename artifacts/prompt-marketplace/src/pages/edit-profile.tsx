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
  // Step 1: request presigned URL
  const urlRes = await fetch(`${basePath}/api/storage/uploads/request-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  // Step 2: upload directly to GCS
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Upload failed");

  // Return serving URL
  return `${basePath}/api/storage${objectPath}`;
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
    orgType: "individual" as "individual" | "firm",
    categories: [] as string[],
    username: "",
    avatarUrl: null as string | null,
  });
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
        orgType: (profile.orgType as "individual" | "firm") ?? "individual",
        categories: profile.categories ?? [],
        username: profile.username ?? "",
        avatarUrl: profile.avatarUrl ?? null,
      });
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
    if (!form.displayName.trim()) return;
    setSaveState("saving");
    setSaveError("");

    try {
      let finalAvatarUrl = form.avatarUrl;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        finalAvatarUrl = await uploadAvatar(avatarFile);
      }

      const targetUsername = username === "me" ? profile?.username : username;
      const res = await fetch(`${basePath}/api/users/${targetUsername}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: isFirmProfile ? (form.orgName.trim() || form.displayName.trim()) : form.displayName.trim(),
          bio: form.bio.trim() || null,
          orgType: form.orgType,
          orgName: isFirmProfile ? (form.orgName.trim() || null) : (form.orgType === "firm" ? (form.orgName.trim() || form.displayName.trim()) : null),
          categories: form.categories,
          avatarUrl: finalAvatarUrl,
          username: form.username !== profile?.username ? form.username : undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any).error ?? "Failed to save");
      }

      const updated = await res.json();
      queryClient.invalidateQueries({ queryKey: ["profile-edit", username] });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users", "me", "username"] });
      queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
      setAvatarFile(null);
      setAvatarPreview(null);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);

      // If username changed, navigate to new URL
      if (updated.username !== targetUsername) {
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

          {/* Avatar upload */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">
              Photo
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-16 h-16 rounded-2xl overflow-hidden group shrink-0"
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: isFirmProfile ? "var(--orange)" : "rgba(0,0,0,0.10)", color: isFirmProfile ? undefined : "rgba(0,0,0,0.3)" }}
                  >
                    {(form.orgName || form.displayName || "?")[0]}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[13px] font-medium text-foreground/70 hover:text-foreground transition-colors"
                >
                  {currentAvatar ? "Change photo" : "Upload photo"}
                </button>
                <p className="text-[11px] text-foreground/40 mt-0.5">JPG, PNG or WebP. Max 5MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Firm name — only label for firm profiles */}
          {isFirmProfile && (
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Firm name</label>
              <input
                type="text"
                value={form.orgName}
                onChange={(e) => setForm(p => ({ ...p, orgName: e.target.value, displayName: e.target.value }))}
                placeholder="Your firm's public name"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          )}

          {/* Display name — only for personal profiles */}
          {!isFirmProfile && (
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Display name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm(p => ({ ...p, displayName: e.target.value }))}
                placeholder="Your name as shown on prompts"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          )}

          {/* Username / handle */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Username (handle)</label>
            <div className="flex items-center bg-[#f5f5f7] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="pl-4 text-[14px] text-foreground/40">@</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                placeholder="yourhandle"
                className="flex-1 bg-transparent px-2 py-3 text-[14px] font-mono focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-foreground/40 mt-1">Changing your handle will break existing links to your profile.</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
              placeholder="A short description of what you do"
              rows={3}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
            />
          </div>

          {/* Specialities */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Specialities</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                    form.categories.includes(cat)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground/60 border-black/[0.08] hover:border-black/20 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Account type — only for personal profiles */}
          {!isFirmProfile && (
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Account type</label>
              <div className="flex gap-3">
                {(["individual", "firm"] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, orgType: type }))}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors border ${
                      form.orgType === type
                        ? "border-foreground bg-foreground text-background"
                        : "border-black/[0.08] text-foreground/60 hover:border-black/20"
                    }`}
                  >
                    {type === "individual" ? "Individual" : "Organization"}
                  </button>
                ))}
              </div>
              {form.orgType === "firm" && (
                <>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={form.orgName}
                      onChange={(e) => setForm(p => ({ ...p, orgName: e.target.value }))}
                      placeholder="Organization name"
                      className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <p className="text-[11px] text-foreground/40 mt-2">
                    To manage multiple separate firm identities, use <Link href="/firms" className="underline hover:text-foreground">My firms</Link>.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Save */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saveState === "saving" || !form.displayName.trim()}
              className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
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
