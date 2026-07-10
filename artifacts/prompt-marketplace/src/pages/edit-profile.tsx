import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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

export default function EditProfile() {
  const { username = "me" } = useParams();
  const { isSignedIn, isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useProfile(username, isLoaded && !!isSignedIn);

  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    orgName: "",
    orgType: "individual" as "individual" | "firm",
    categories: [] as string[],
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        orgName: profile.orgName ?? "",
        orgType: (profile.orgType as "individual" | "firm") ?? "individual",
        categories: profile.categories ?? [],
      });
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim()) return;
    setSaveState("saving");
    try {
      const targetUsername = username === "me" ? profile?.username : username;
      const res = await fetch(`${basePath}/api/users/${targetUsername}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim() || null,
          orgType: form.orgType,
          orgName: form.orgType === "firm" ? (form.orgName.trim() || form.displayName.trim()) : null,
          categories: form.categories,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["profile-edit", username] });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      queryClient.invalidateQueries({ queryKey: ["firms", "mine"] });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
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

  const isFirmProfile = profile?.orgType === "firm" && !!(profile as any)?.ownerClerkUserId;
  const backHref = username === "me"
    ? (profile ? `/profile/${profile.username}` : "/")
    : `/profile/${username}`;

  if (!isLoaded || isLoading) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-6 py-16 space-y-4">
          <Skeleton className="h-8 w-40" />
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

          {/* Firm name (only for firm profiles) */}
          {form.orgType === "firm" && (
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Firm name</label>
              <input
                type="text"
                value={form.orgName}
                onChange={(e) => setForm(p => ({ ...p, orgName: e.target.value }))}
                placeholder="Your firm's public name"
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          )}

          {/* Display name */}
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

          {/* Account type — only editable for personal profiles */}
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
                <p className="text-[11px] text-foreground/40 mt-2">
                  You can also create separate firm identities under <Link href="/firms" className="underline hover:text-foreground">My firms</Link>.
                </p>
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
                <CheckCircle className="h-4 w-4" />
                Saved
              </div>
            )}
            {saveState === "error" && (
              <div className="flex items-center gap-1.5 text-[13px] text-red-500">
                <AlertCircle className="h-4 w-4" />
                Failed to save
              </div>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
