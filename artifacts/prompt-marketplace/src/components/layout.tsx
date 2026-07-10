import { Link, useLocation } from "wouter";
import { Search, UserCircle, Plus } from "lucide-react";
import { useTheme } from "./theme-provider";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Apple-style nav: frosted glass, centered logo, minimal links */}
      <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] bg-white/80 dark:bg-background/80 dark:border-white/[0.06] backdrop-blur-xl">
        <div className="container mx-auto max-w-6xl flex h-12 items-center px-6 gap-8">
          {/* Logo */}
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-foreground hover:opacity-70 transition-opacity shrink-0"
            data-testid="nav-logo"
          >
            Promptly
          </Link>

          {/* Nav links */}
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

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/onboarding"
              className="text-sm text-foreground/60 hover:text-foreground transition-colors px-3 py-1.5 hidden sm:block"
              data-testid="nav-join"
            >
              Sign up
            </Link>
            <Link
              href="/create"
              className="flex items-center gap-1.5 bg-foreground text-background px-4 py-1.5 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
              data-testid="nav-create"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </Link>
            <Link
              href="/profile/me"
              className="text-foreground/50 hover:text-foreground transition-colors p-1.5"
              data-testid="nav-profile"
            >
              <UserCircle className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-foreground/40 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
              data-testid="nav-theme-toggle"
              aria-label="Toggle theme"
            >
              <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] py-10 mt-auto">
        <div className="container mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-[13px] text-foreground/40">
          <span>Copyright &copy; 2025 Promptly. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/explore" className="hover:text-foreground/70 transition-colors">Explore</Link>
            <Link href="/create" className="hover:text-foreground/70 transition-colors">Create</Link>
            <Link href="/onboarding" className="hover:text-foreground/70 transition-colors">Join</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
