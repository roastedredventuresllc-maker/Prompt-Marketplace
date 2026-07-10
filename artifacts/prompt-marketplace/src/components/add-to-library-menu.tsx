import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { BookmarkPlus, Check, Loader2, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type LibraryOption = { id: number; name: string; promptCount: number; kind?: string };

type AddToLibraryMenuProps = {
  promptId: number;
  /** "icon" = just the bookmark icon, "pill" = pill with label */
  variant?: "icon" | "pill";
  onAdded?: () => void;
};

export function AddToLibraryMenu({ promptId, variant = "pill", onAdded }: AddToLibraryMenuProps) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch current user info + libraries when open
  const { data: meData } = useQuery<{ username: string | null }>({
    queryKey: ["users", "me", "username"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/users/me`, { credentials: "include" });
      if (!res.ok) return { username: null };
      const d = await res.json();
      return { username: d.username ?? null };
    },
    enabled: !!isSignedIn,
    staleTime: 60_000,
  });

  const { data: libraries, isLoading } = useQuery<LibraryOption[]>({
    queryKey: ["me-libraries"],
    queryFn: async () => {
      const username = meData?.username;
      if (!username) return [];
      const res = await fetch(`${basePath}/api/users/${username}/libraries`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isSignedIn && open && !!meData?.username,
    staleTime: 30_000,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
        setCreateError("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isSignedIn) return null;

  async function handleAdd(libraryId: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (justAdded.has(libraryId)) return;
    setAdding(libraryId);
    await fetch(`${basePath}/api/libraries/${libraryId}/prompts`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId }),
    });
    setJustAdded(prev => new Set([...prev, libraryId]));
    setAdding(null);
    queryClient.invalidateQueries({ queryKey: ["me-libraries"] });
    onAdded?.();
    setTimeout(() => setOpen(false), 700);
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!newName.trim()) return;
    const username = meData?.username;
    if (!username) {
      setCreateError("Set a username in your profile first.");
      return;
    }
    setSaving(true);
    setCreateError("");
    const createRes = await fetch(`${basePath}/api/libraries`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), authorUsername: username, isPublic: true, kind: "saved" }),
    });
    if (!createRes.ok) {
      setCreateError("Failed to create collection. Try again.");
      setSaving(false);
      return;
    }
    const lib = await createRes.json();
    await fetch(`${basePath}/api/libraries/${lib.id}/prompts`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId }),
    });
    queryClient.invalidateQueries({ queryKey: ["me-libraries"] });
    onAdded?.();
    setSaving(false);
    setCreating(false);
    setNewName("");
    setCreateError("");
    setOpen(false);
  }

  const triggerClass = variant === "icon"
    ? "flex items-center justify-center w-7 h-7 rounded-lg bg-black/[0.05] hover:bg-black/[0.10] text-foreground/50 hover:text-foreground transition-all"
    : "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.10] text-[12px] font-medium text-foreground/50 hover:text-foreground transition-all";

  return (
    <div ref={ref} className="relative" style={{ zIndex: 50 }}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className={triggerClass}
        title="Add to collection"
        aria-label="Add to collection"
      >
        <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
        {variant === "pill" && <span>Save</span>}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 w-60 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-black/[0.06] overflow-hidden"
          style={{ zIndex: 9999 }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="px-4 py-3 border-b border-black/[0.05]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/35">Save to collection</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
            </div>
          ) : libraries && libraries.length > 0 ? (
            <div className="max-h-52 overflow-y-auto divide-y divide-black/[0.04]">
              {libraries.map(lib => {
                const done = justAdded.has(lib.id);
                return (
                  <button
                    key={lib.id}
                    onClick={e => handleAdd(lib.id, e)}
                    disabled={adding === lib.id || done}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f5f5f7] transition-colors text-left disabled:opacity-60"
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                      style={{ background: done ? "var(--orange)" : "rgba(0,0,0,0.12)" }}>
                      {done ? <Check className="h-3 w-3" /> : lib.name[0]}
                    </div>
                    <span className="flex-1 text-[13px] font-medium text-foreground/80 truncate">{lib.name}</span>
                    {adding === lib.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-foreground/30" />
                    ) : done ? (
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--orange)" }}>Added</span>
                    ) : (
                      <span className="text-[11px] text-foreground/25 shrink-0 tabular-nums">{lib.promptCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-[13px] text-foreground/40">No collections yet</p>
            </div>
          )}

          {/* Create new */}
          <div className="border-t border-black/[0.05]">
            {creating ? (
              <form onSubmit={handleCreateAndAdd} className="p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Collection name…" autoFocus
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-[#f5f5f7] rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <button
                    type="submit"
                    disabled={saving || !newName.trim()}
                    onClick={e => e.stopPropagation()}
                    className="px-2.5 py-1.5 bg-foreground text-background rounded-lg text-[11px] font-medium hover:opacity-80 disabled:opacity-40 shrink-0"
                  >
                    {saving ? "…" : "Add"}
                  </button>
                </div>
                {createError && <p className="text-[11px] text-red-500">{createError}</p>}
              </form>
            ) : (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={e => { e.preventDefault(); e.stopPropagation(); setCreating(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#f5f5f7] transition-colors text-[13px] text-foreground/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New collection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
