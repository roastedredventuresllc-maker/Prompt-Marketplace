import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Loader2, ShieldCheck, X } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function parseParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    clientId: p.get("client_id") ?? "",
    redirectUri: p.get("redirect_uri") ?? "",
    state: p.get("state") ?? "",
    codeChallenge: p.get("code_challenge") ?? "",
    codeChallengeMethod: p.get("code_challenge_method") ?? "S256",
    scope: p.get("scope") ?? "",
  };
}

export default function OAuthAuthorize() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const params = parseParams();

  // If not signed in, redirect to sign-in preserving this URL as return destination
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      sessionStorage.setItem("oauthReturn", window.location.pathname + window.location.search);
      setLocation("/sign-in");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  // After sign-in, Clerk redirects back — restore the OAuth flow
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const saved = sessionStorage.getItem("oauthReturn");
    if (saved && !window.location.search) {
      sessionStorage.removeItem("oauthReturn");
      setLocation(saved.replace(basePath, "") || "/oauth/authorize-ui");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  async function handleAuthorize() {
    if (!params.redirectUri || !params.codeChallenge) {
      setErrorMsg("Missing required OAuth parameters. Return to Claude and try connecting again.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const r = await fetch(`${basePath}/api/oauth/code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: params.clientId,
          redirectUri: params.redirectUri,
          codeChallenge: params.codeChallenge,
          codeChallengeMethod: params.codeChallengeMethod,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to issue code");
      const dest = new URL(params.redirectUri);
      dest.searchParams.set("code", data.code);
      if (params.state) dest.searchParams.set("state", params.state);
      window.location.href = dest.toString();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  function handleDeny() {
    if (!params.redirectUri) { setLocation("/"); return; }
    const dest = new URL(params.redirectUri);
    dest.searchParams.set("error", "access_denied");
    if (params.state) dest.searchParams.set("state", params.state);
    window.location.href = dest.toString();
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7]">
        <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-black/[0.06]">
          <div className="flex items-center gap-3 mb-5">
            {/* Promptly logo mark */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-[18px]"
              style={{ background: "var(--orange, #FF6B35)" }}>
              P
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="h-px flex-1 bg-black/[0.08]" />
              <ShieldCheck className="h-4 w-4 text-foreground/30" />
              <div className="h-px flex-1 bg-black/[0.08]" />
            </div>
            {/* Claude logo mark */}
            <div className="w-10 h-10 rounded-xl bg-[#D97757] flex items-center justify-center text-white font-bold text-[18px]">
              C
            </div>
          </div>
          <h1 className="text-[20px] font-bold tracking-tight text-foreground">
            Connect Claude to Promptly
          </h1>
          <p className="text-[14px] text-foreground/50 mt-1">
            Signed in as <span className="font-medium text-foreground/70">{user?.primaryEmailAddress?.emailAddress}</span>
          </p>
        </div>

        {/* Permissions */}
        <div className="px-8 py-6">
          <p className="text-[13px] font-semibold text-foreground/60 mb-3 uppercase tracking-wide">
            Claude will be able to
          </p>
          <ul className="space-y-2.5">
            {[
              "Search and read prompts from the marketplace",
              "View and use prompts you've purchased",
              "Purchase prompts using your account credits",
              "Create and manage your own prompts",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] text-foreground/70">
                <span className="mt-0.5 text-green-500 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {status === "error" && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex flex-col gap-3">
          <button
            onClick={handleAuthorize}
            disabled={status === "loading"}
            className="w-full h-11 rounded-xl font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--orange, #FF6B35)" }}
          >
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status === "loading" ? "Connecting…" : "Authorize Claude"}
          </button>
          <button
            onClick={handleDeny}
            disabled={status === "loading"}
            className="w-full h-11 rounded-xl font-medium text-[14px] text-foreground/50 flex items-center justify-center gap-1.5 hover:text-foreground hover:bg-black/[0.04] transition-colors"
          >
            <X className="h-4 w-4" /> Deny access
          </button>
        </div>

        <p className="text-center text-[11px] text-foreground/30 pb-5 px-8">
          Promptly will create a dedicated API key for Claude. You can revoke access any time from Settings → API Keys.
        </p>
      </div>
    </div>
  );
}
