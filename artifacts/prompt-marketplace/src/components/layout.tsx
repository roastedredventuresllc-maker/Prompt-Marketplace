import { Link, useLocation } from "wouter";
import { Search, UserCircle, Plus, Sparkles } from "lucide-react";
import { useTheme } from "./theme-provider";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-6xl flex h-14 items-center px-4 md:px-6 gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors shrink-0" data-testid="nav-logo">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="tracking-tight">Promptly</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/explore"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:bg-secondary ${location === "/explore" ? "text-foreground bg-secondary" : "text-muted-foreground"}`}
              data-testid="nav-explore"
            >
              <span className="flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Explore
              </span>
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/create"
              className="hidden md:flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="nav-create"
            >
              <Plus className="h-4 w-4" /> New prompt
            </Link>
            <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block" data-testid="nav-join">
              Join
            </Link>
            <Link href="/profile/me" className="text-muted-foreground hover:text-primary transition-colors" data-testid="nav-profile">
              <UserCircle className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary"
              data-testid="nav-theme-toggle"
              aria-label="Toggle theme"
            >
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 mt-auto">
        <div className="container mx-auto max-w-6xl px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Promptly</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <Link href="/create" className="hover:text-foreground transition-colors">Create</Link>
            <Link href="/onboarding" className="hover:text-foreground transition-colors">Join</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
