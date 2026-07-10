import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { useGetPrompt, useListCategories, getGetPromptQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, CheckCircle, X, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PromptEdit() {
  const { id } = useParams();
  const promptId = Number(id);
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: prompt, isLoading } = useGetPrompt(promptId, {
    query: { enabled: !!promptId && isLoaded, queryKey: getGetPromptQueryKey(promptId) },
  });
  const { data: categories, isLoading: catsLoading } = useListCategories();

  const [form, setForm] = useState({
    title: "",
    content: "",
    description: "",
    categoryId: 0,
    tags: [] as string[],
    isPublic: true,
  });
  const [tagInput, setTagInput] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (prompt) {
      setForm({
        title: prompt.title,
        content: prompt.content,
        description: prompt.description ?? "",
        categoryId: prompt.categoryId,
        tags: prompt.tags ?? [],
        isPublic: prompt.isPublic,
      });
    }
  }, [prompt]);

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !form.tags.includes(t) && form.tags.length < 8) {
      setForm(p => ({ ...p, tags: [...p.tags, t] }));
      setTagInput("");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.categoryId) {
      setError("Title, content and category are required.");
      return;
    }
    setError("");
    setSaveState("saving");
    try {
      const res = await fetch(`${basePath}/api/prompts/${promptId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any).error ?? "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: getGetPromptQueryKey(promptId) });
      setSaveState("saved");
      setTimeout(() => setLocation(`/prompt/${promptId}`), 1200);
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
      setSaveState("error");
    }
  }

  if (!isLoaded || isLoading) {
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

  if (!prompt) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] text-foreground/50">
          Prompt not found
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href={`/prompt/${promptId}`} className="flex items-center gap-1.5 text-[13px] text-foreground/40 hover:text-foreground mb-8 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to prompt
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Edit prompt</h1>
          <p className="text-[13px] text-foreground/40 mt-1">by @{prompt.authorUsername}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl">{error}</div>
          )}

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Prompt content *</label>
            <textarea
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-foreground/20 min-h-[200px] resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Category *</label>
            <select
              value={form.categoryId}
              onChange={e => setForm(p => ({ ...p, categoryId: Number(e.target.value) }))}
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 appearance-none"
            >
              <option value={0} disabled>Choose a category…</option>
              {!catsLoading && categories?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Tags</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.tags.map(t => (
                <span key={t} className="flex items-center gap-1 px-3 py-1 bg-foreground/[0.06] rounded-full text-[12px] font-medium">
                  #{t}
                  <button type="button" onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))} className="text-foreground/40 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag…"
                className="flex-1 bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button type="button" onClick={addTag} className="px-4 py-2.5 bg-[#f5f5f7] rounded-xl text-[13px] font-medium hover:bg-[#eaeaea] transition-colors flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, isPublic: !p.isPublic }))}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.isPublic ? "bg-foreground" : "bg-foreground/20"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublic ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-[14px] font-medium">{form.isPublic ? "Public" : "Private"}</span>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saveState === "saving"}
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
          </div>
        </form>
      </div>
    </Layout>
  );
}
