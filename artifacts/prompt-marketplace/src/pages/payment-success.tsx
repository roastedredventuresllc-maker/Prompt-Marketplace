import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { CheckCircle, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

type State = "verifying" | "success" | "error" | "no_payment";

export default function PaymentSuccess() {
  const [, params] = useLocation();
  const [state, setState] = useState<State>("verifying");
  const [itemType, setItemType] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Whop may pass the checkout config ID under various param names
    const checkoutConfigId =
      urlParams.get("checkout_config_id") ??
      urlParams.get("checkout_id") ??
      urlParams.get("id");
    const type = urlParams.get("item_type");
    const id = urlParams.get("item_id");

    setItemType(type);
    setItemId(id);

    if (!checkoutConfigId) {
      setState("no_payment");
      return;
    }

    // Verify the purchase server-side
    fetch("/api/whop/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ checkoutConfigId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setItemType(data.itemType ?? type);
          setItemId(String(data.itemId ?? id));
          setState("success");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  const returnHref = itemType && itemId
    ? itemType === "prompt" ? `/prompt/${itemId}` : `/library/${itemId}`
    : "/explore";

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-sm w-full bg-white rounded-3xl p-10 shadow-[0_4px_32px_rgba(0,0,0,0.10)] border border-black/[0.05] text-center">
          {state === "verifying" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-7 w-7 text-foreground/40 animate-spin" />
              </div>
              <h1 className="text-[22px] font-bold mb-2">Confirming payment…</h1>
              <p className="text-[14px] text-foreground/50">Just a moment while we verify your purchase.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "var(--orange-subtle)" }}>
                <CheckCircle className="h-7 w-7" style={{ color: "var(--orange)" }} />
              </div>
              <h1 className="text-[22px] font-bold mb-2">You're in!</h1>
              <p className="text-[14px] text-foreground/55 mb-8">
                {itemType === "library"
                  ? "Your collection is now unlocked. All prompts inside are yours."
                  : "Your prompt is now unlocked and ready to copy."}
              </p>
              <Link
                href={returnHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white hover:opacity-80 transition-opacity"
                style={{ background: "var(--orange)" }}
              >
                {itemType === "library" ? "View collection" : "View prompt"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {(state === "error" || state === "no_payment") && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-7 w-7 text-foreground/35" />
              </div>
              <h1 className="text-[22px] font-bold mb-2">Payment not confirmed</h1>
              <p className="text-[14px] text-foreground/55 mb-8">
                We couldn't verify your payment yet. If you completed checkout, your access will appear shortly — try reopening the prompt.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={returnHref}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] text-white hover:opacity-80 transition-opacity"
                  style={{ background: "#1d1d1f" }}
                >
                  Back to prompt
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/explore" className="text-[13px] text-foreground/40 hover:text-foreground transition-colors">
                  Browse more prompts
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
