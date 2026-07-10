import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useCreatePrompt, useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProfileData = { username: string; displayName: string; orgType: string; orgName: string | null };
type FirmData = { id: number; username: string; displayName: string; orgName: string | null };

function useMyProfile(enabled: boolean) {
  return useQuery<ProfileData | null>({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/users/me`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled,
    retry: false,
  });
}

function useMyFirms(enabled: boolean) {
  return useQuery<FirmData[]>({
    queryKey: ["firms", "mine"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/firms/mine`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
    retry: false,
  });
}

export default function CreatePrompt() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useMyProfile(isLoaded && !!isSignedIn);
  const { data: firms = [] } = useMyFirms(isLoaded && !!isSignedIn);
  const { data: categories, isLoading: catsLoading } = useListCategories();
  const createPrompt = useCreatePrompt();

  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    description: "",
    categoryId: 0,
    tags: [] as string[],
    isPublic: true,
  });
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");

  // Redirect to onboarding if signed in but no profile yet
  useEffect(() => {
    if (isLoaded && isSignedIn && !profileLoading && !profile) {
      setLocation("/onboarding");
    }
  }, [isLoaded, isSignedIn, profileLoading, profile, setLocation]);

  // Default author to self when profile loads
  useEffect(() => {
    if (profile && !selectedAuthor) setSelectedAuthor(profile.username);
  }, [profile, selectedAuthor]);

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !form.tags.includes(t) && form.tags.length < 8) {
      setForm((p) => ({ ...p, tags: [...p.tags, t] }));
      setTagInput("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.categoryId) {
      setError("Title, content, and category are required.");
      return;
    }
    const authorUsername = selectedAuthor || profile?.username;
    if (!authorUsername) return;

    setError("");
    createPrompt.mutate(
      { data: { ...form, authorUsername } },
      {
        onSuccess: (p) => setLocation(`/prompt/${p.id}`),
        onError: (err: any) => setError(err?.message ?? "Failed to publish. Please try again."),
      },
    );
  }

  // Not signed in
  if (isLoaded && !isSignedIn) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center bg-[#f5f5f7]">
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-10 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-foreground/[0.06] flex items-center justify-center mx-auto mb-5">
              <LogIn className="h-5 w-5 text-foreground/50" />
            </div>
            <h2 className="text-xl font-bold mb-2">Sign in to publish</h2>
            <p className="text-[14px] text-foreground/50 mb-6">Create an account to share your prompts with the world.</p>
            <Link href="/sign-up" className="block w-full bg-foreground text-background py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity text-center mb-3">
              Create free account
            </Link>
            <Link href="/sign-in" className="block w-full text-[14px] text-foreground/60 hover:text-foreground text-center">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Loading
  if (!isLoaded || profileLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-16 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  // Build author options: own profile + firms
  const authorOptions: { username: string; label: string }[] = [
    ...(profile ? [{ username: profile.username, label: `Me — @${profile.username}` }] : []),
    ...firms.map(f => ({ username: f.username, label: `${f.orgName ?? f.displayName} — @${f.username}` })),
  ];
  const activeAuthor = authorOptions.find(o => o.username === selectedAuthor) ?? authorOptions[0];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-3">New prompt</h1>

          {/* Author selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-foreground/40">Publishing as</span>
              {authorOptions.length > 1 ? (
                <select
                  value={selectedAuthor ?? ""}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="text-[12px] font-semibold text-foreground bg-[#f5f5f7] rounded-lg px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-foreground/20 cursor-pointer"
                >
                  {authorOptions.map(o => (
                    <option key={o.username} value={o.username}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] font-semibold text-foreground/70">
                  {activeAuthor?.label ?? `@${profile?.username}`}
                </span>
              )}
            </div>
            <Link href="/firms" className="text-[11px] text-foreground/40 hover:text-foreground transition-colors">
              Manage firms →
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Give your prompt a clear, descriptive title"
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              data-testid="input-title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="One sentence on what this prompt does"
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              data-testid="input-description"
            />
          </div>

          {/* Prompt content */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Prompt content *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Write your prompt here. Use {placeholders} for variable parts."
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-foreground/20 min-h-[200px] resize-none leading-relaxed"
              data-testid="input-content"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Category *</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: Number(e.target.value) }))}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 appearance-none"
              data-testid="select-category"
            >
              <option value={0} disabled>Choose a category…</option>
              {!catsLoading && categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Tags <span className="normal-case font-normal">(up to 8, optional)</span></label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-3 py-1 bg-foreground/[0.06] rounded-full text-[12px] font-medium">
                  #{t}
                  <button type="button" onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))} className="text-foreground/40 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag…"
                className="flex-1 bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button type="button" onClick={addTag} className="px-4 py-2.5 bg-[#f5f5f7] rounded-xl text-[13px] font-medium hover:bg-[#eaeaea] transition-colors flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isPublic: !p.isPublic }))}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.isPublic ? "bg-foreground" : "bg-foreground/20"}`}
              data-testid="toggle-public"
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublic ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-[14px] font-medium">{form.isPublic ? "Public" : "Private"}</span>
            <span className="text-[13px] text-foreground/40">{form.isPublic ? "Visible to everyone" : "Only you can see this"}</span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={createPrompt.isPending}
              className="w-full bg-foreground text-background py-3.5 rounded-full font-medium text-[15px] hover:opacity-80 transition-opacity disabled:opacity-50"
              data-testid="btn-publish"
            >
              {createPrompt.isPending ? "Publishing…" : "Publish prompt"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
