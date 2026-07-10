import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import Home from "@/pages/home";
import Explore from "@/pages/explore";
import PromptDetail from "@/pages/prompt-detail";
import Profile from "@/pages/profile";
import LibraryDetail from "@/pages/library-detail";
import Onboarding from "@/pages/onboarding";
import CreatePrompt from "@/pages/create-prompt";
import PaymentSuccess from "@/pages/payment-success";
import Settings from "@/pages/settings";
import EditProfile from "@/pages/edit-profile";
import Firms from "@/pages/firms";
import PromptEdit from "@/pages/prompt-edit";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1d1d1f",
    colorForeground: "#1d1d1f",
    colorMutedForeground: "#6e6e73",
    colorDanger: "#ff3b30",
    colorBackground: "#ffffff",
    colorInput: "#f5f5f7",
    colorInputForeground: "#1d1d1f",
    colorNeutral: "#d2d2d7",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[22px] font-bold tracking-tight text-[#1d1d1f]",
    headerSubtitle: "text-[14px] text-[#6e6e73]",
    socialButtonsBlockButtonText: "text-[14px] font-medium text-[#1d1d1f]",
    formFieldLabel: "text-[13px] font-medium text-[#1d1d1f]",
    footerActionLink: "text-[#1d1d1f] font-semibold hover:underline",
    footerActionText: "text-[#6e6e73] text-[13px]",
    dividerText: "text-[#6e6e73] text-[13px]",
    identityPreviewEditButton: "text-[#1d1d1f] font-medium",
    formFieldSuccessText: "text-[#34c759] text-[13px]",
    alertText: "text-[#1d1d1f] text-[13px]",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-10 w-10 rounded-xl",
    socialButtonsBlockButton: "border border-[#e8e8ed] rounded-xl hover:bg-[#f5f5f7] transition-colors h-11",
    formButtonPrimary: "bg-[#1d1d1f] hover:bg-[#3a3a3c] text-white rounded-xl font-medium transition-colors h-11",
    formFieldInput: "bg-[#f5f5f7] border-0 rounded-xl text-[#1d1d1f] h-11 focus:ring-2 focus:ring-[#1d1d1f]/20",
    footerAction: "bg-[#f9f9f9] border-t border-[#f5f5f7]",
    dividerLine: "bg-[#e8e8ed]",
    alert: "rounded-xl border border-[#f5d0d0] bg-[#fff5f5]",
    otpCodeFieldInput: "bg-[#f5f5f7] border border-[#e8e8ed] rounded-xl text-[#1d1d1f]",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== id) qc.clear();
      prevRef.current = id;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
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
      <Route path="/settings" component={Settings} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/profile/edit/:username" component={EditProfile} />
      <Route path="/firms" component={Firms} />
      <Route path="/prompt/:id/edit" component={PromptEdit} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your Promptly account" } },
        signUp: { start: { title: "Join Promptly", subtitle: "Publish prompts, build collections, grow your audience" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider defaultTheme="light" storageKey="prompt-market-theme">
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
