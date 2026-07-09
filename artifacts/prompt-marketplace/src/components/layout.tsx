import { Link, useLocation } from "wouter";
import { Terminal, Search, UserCircle, Plus, LayoutGrid } from "lucide-react";
import { useTheme } from "./theme-provider";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl flex h-14 items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary hover:opacity-80 transition-opacity" data-testid="nav-logo">
            <Terminal className="h-5 w-5" />
            <span>PROMPT_MARKET</span>
          </Link>
          
          <nav className="flex items-center gap-6 ml-8 text-sm font-medium">
            <Link href="/explore" className={`transition-colors hover:text-primary ${location === '/explore' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-explore">
              <span className="flex items-center gap-1.5"><Search className="h-4 w-4" /> Explore</span>
            </Link>
          </nav>
          
          <div className="ml-auto flex items-center gap-4">
            <Link href="/create" className="hidden md:flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="nav-create">
              <Plus className="h-4 w-4" /> Publish
            </Link>
            <Link href="/profile/me" className="text-muted-foreground hover:text-primary transition-colors" data-testid="nav-profile">
              <UserCircle className="h-5 w-5" />
            </Link>
            {/* Simple toggle for demo */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground hover:text-primary transition-colors h-5 w-5 flex items-center justify-center"
              data-testid="nav-theme-toggle"
            >
              <div className="w-3 h-3 rounded-full border border-current" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      
      <footer className="border-t border-border/40 py-6 md:py-8 mt-auto">
        <div className="container mx-auto max-w-7xl px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span>© 2024 PROMPT_MARKET. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <Link href="/onboarding" className="hover:text-foreground transition-colors">Join</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
