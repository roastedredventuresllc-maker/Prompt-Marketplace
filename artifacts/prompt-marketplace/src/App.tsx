import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';

// Pages
import Home from '@/pages/home';
import Explore from '@/pages/explore';
import PromptDetail from '@/pages/prompt-detail';
import Profile from '@/pages/profile';
import LibraryDetail from '@/pages/library-detail';
import Onboarding from '@/pages/onboarding';
import CreatePrompt from '@/pages/create-prompt';
import { Layout } from '@/components/layout';

// Fallback components if needed
import { Terminal } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="bg-secondary/50 p-4 rounded-full mb-6">
          <Terminal className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">404: Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          The requested resource could not be found on the marketplace server.
        </p>
      </div>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/explore" component={Explore} />
      <Route path="/prompt/:id" component={PromptDetail} />
      <Route path="/profile/:username" component={Profile} />
      <Route path="/library/:id" component={LibraryDetail} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/create" component={CreatePrompt} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="prompt-market-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
