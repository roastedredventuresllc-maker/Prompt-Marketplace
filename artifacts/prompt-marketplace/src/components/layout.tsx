import { Link, useLocation } from "wouter";
import { Search, Plus, LogIn, UserCircle, Building2, ChevronDown } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useUser, useClerk, Show } from "@clerk/react";
import { useState, useRef, useEffect } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = user.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-black/[0.04] transition-colors"
        data-testid="user-menu-btn"
      >
        {user.imageUrl ? (
          <img src={user.imageUrl} alt={user.fullName ?? ""} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-[11px] font-semibold">
            {initials}
          </div>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-foreground/50" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/[0.06] py-1.5 z-50">
          <div className="px-4 py-2.5 border-b border-black/[0.06]">
            <p className="text-[13px] font-semibold text-foreground truncate">{user.fullName ?? "Account"}</p>
            <p className="text-[11px] text-foreground/40 truncate">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-[13px] text-foreground/70 hover:bg-black/[0.04] hover:text-foreground transition-colors"
            data-testid="menu-profile"
          >
            Set up profile
          </Link>
          <Link
            href="/create"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-[13px] text-foreground/70 hover:bg-black/[0.04] hover:text-foreground transition-colors"
            data-testid="menu-create"
          >
            New prompt
          </Link>
          <div className="border-t border-black/[0.06] mt-1 pt-1">
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="w-full text-left px-4 py-2 text-[13px] text-foreground/70 hover:bg-black/[0.04] hover:text-foreground transition-colors"
              data-testid="menu-signout"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto max-w-6xl flex h-12 items-center px-6 gap-8">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-foreground hover:opacity-70 transition-opacity shrink-0"
            data-testid="nav-logo"
          >
            Promptly
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/explore"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                location === "/explore"
                  ? "text-foreground bg-black/[0.06] dark:bg-white/[0.08]"
                  : "text-foreground/60 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
              }`}
              data-testid="nav-explore"
            >
              Explore
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Auth-aware actions */}
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-sm text-foreground/60 hover:text-foreground transition-colors px-3 py-1.5 hidden sm:block"
                data-testid="nav-signin"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="flex items-center gap-1.5 bg-foreground text-background px-4 py-1.5 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
                data-testid="nav-signup"
              >
                <LogIn className="h-3.5 w-3.5" /> Get started
              </Link>
            </Show>

            <Show when="signed-in">
              <Link
                href="/create"
                className="flex items-center gap-1.5 bg-foreground text-background px-4 py-1.5 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
                data-testid="nav-create"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
              <UserMenu />
            </Show>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-foreground/40 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-black/[0.04]"
              data-testid="nav-theme-toggle"
              aria-label="Toggle theme"
            >
              <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] py-10 mt-auto">
        <div className="container mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-[13px] text-foreground/40">
          <span>Copyright &copy; 2025 Promptly. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/explore" className="hover:text-foreground/70 transition-colors">Explore</Link>
            <Link href="/sign-up" className="hover:text-foreground/70 transition-colors">Join</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
