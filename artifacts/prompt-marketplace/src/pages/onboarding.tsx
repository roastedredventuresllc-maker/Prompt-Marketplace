import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useCreateUser, useListCategories } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Check, ArrowRight, Building2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const { user: clerkUser } = useUser();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const createUser = useCreateUser();

  const [formData, setFormData] = useState({
    username: "",
    displayName: clerkUser?.fullName ?? "",
    bio: "",
    categories: [] as string[],
    orgType: "individual" as "individual" | "firm",
    orgName: "",
  });
  const [error, setError] = useState("");

  const handleNext = () => {
    if (step === 1) {
      if (!formData.username || !formData.displayName) {
        setError("Username and Display Name are required");
        return;
      }
      if (formData.username.length < 3) {
        setError("Username must be at least 3 characters");
        return;
      }
      if (formData.orgType === "firm" && !formData.orgName.trim()) {
        setError("Please enter your organization name");
        return;
      }
      setError("");
      setStep(2);
    } else if (step === 2) {
      if (formData.categories.length === 0) {
        setError("Please select at least one category");
        return;
      }
      setError("");
      setStep(3);
    }
  };

  const toggleCategory = (slug: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(slug)
        ? prev.categories.filter((c) => c !== slug)
        : [...prev.categories, slug],
    }));
  };

  const handleSubmit = () => {
    setError("");
    const payload: any = {
      username: formData.username,
      displayName: formData.displayName,
      bio: formData.bio || undefined,
      categories: formData.categories,
      orgType: formData.orgType,
      orgName: formData.orgType === "firm" ? formData.orgName : undefined,
    };

    createUser.mutate({ data: payload }, {
      onSuccess: (user) => {
        // If onboarding was triggered while trying to do something else (e.g.
        // create a prompt), send the user back there instead of stranding
        // them on their brand-new profile page.
        const returnTo = sessionStorage.getItem("onboardingReturnTo");
        sessionStorage.removeItem("onboardingReturnTo");
        setLocation(returnTo || `/profile/${user.username}`);
      },
      onError: () => setError("Failed to create profile. Username might already be taken."),
    });
  };

  const steps = ["Your identity", "Your focus areas", "About you"];

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 bg-[#f5f5f7]">
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((label, i) => {
              const s = i + 1;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      step === s ? "bg-foreground text-background" :
                      step > s ? "bg-foreground/20 text-foreground" :
                      "bg-foreground/10 text-foreground/40"
                    }`}>
                      {step > s ? <Check className="h-4 w-4" /> : s}
                    </div>
                  </div>
                  {s < 3 && <div className={`w-10 h-px ${step > s ? "bg-foreground/30" : "bg-foreground/10"}`} />}
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl text-center">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-1">Create your profile</h2>
                  <p className="text-[14px] text-foreground/50">Set up your public creator identity.</p>
                </div>

                {/* Account type */}
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Account type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "individual", label: "Individual", icon: User, desc: "Personal creator" },
                      { value: "firm", label: "Organization", icon: Building2, desc: "Company or firm" },
                    ].map(({ value, label, icon: Icon, desc }) => (
                      <button
                        key={value}
                        onClick={() => setFormData((p) => ({ ...p, orgType: value as "individual" | "firm" }))}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          formData.orgType === value
                            ? "border-foreground bg-foreground/[0.04]"
                            : "border-black/[0.08] hover:border-foreground/30"
                        }`}
                        data-testid={`org-type-${value}`}
                      >
                        <Icon className="h-4 w-4 mb-1.5 text-foreground/60" />
                        <div className="text-[13px] font-semibold">{label}</div>
                        <div className="text-[11px] text-foreground/40">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.orgType === "firm" && (
                  <div>
                    <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Organization name</label>
                    <input
                      type="text"
                      value={formData.orgName}
                      onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                      placeholder="Acme Capital, Goldman Sachs..."
                      className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 text-[14px]">@</span>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                      placeholder="your_username"
                      className="w-full bg-[#f5f5f7] rounded-xl pl-9 pr-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                      data-testid="input-username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-foreground/40 mb-2">Display name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder={formData.orgType === "firm" ? "Acme Capital Research" : "Your Name"}
                    className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    data-testid="input-display-name"
                  />
                </div>

                <button
                  onClick={handleNext}
                  className="w-full bg-foreground text-background py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity flex items-center justify-center gap-2 mt-2"
                  data-testid="btn-next-1"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-1">What do you focus on?</h2>
                  <p className="text-[14px] text-foreground/50">Select the areas you specialize in.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {categoriesLoading
                    ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)
                    : categories?.map((cat) => {
                        const sel = formData.categories.includes(cat.slug);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.slug)}
                            className={`p-3 rounded-xl border text-[13px] font-medium text-left transition-colors ${
                              sel ? "border-foreground bg-foreground/[0.04]" : "border-black/[0.08] text-foreground/60 hover:border-foreground/30 hover:text-foreground"
                            }`}
                            data-testid={`btn-select-${cat.slug}`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(1)} className="px-5 py-3 bg-[#f5f5f7] rounded-full text-[14px] font-medium hover:bg-[#eaeaea] transition-colors">Back</button>
                  <button onClick={handleNext} className="flex-1 bg-foreground text-background py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity flex items-center justify-center gap-2" data-testid="btn-next-2">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-1">Add a bio</h2>
                  <p className="text-[14px] text-foreground/50">Tell others what you do and what you publish.</p>
                </div>

                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={formData.orgType === "firm" ? "We publish research-grade prompts for financial analysis and due diligence..." : "I build prompts for..."}
                  className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground/20 min-h-[120px] resize-none"
                  data-testid="input-bio"
                />

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(2)} disabled={createUser.isPending} className="px-5 py-3 bg-[#f5f5f7] rounded-full text-[14px] font-medium hover:bg-[#eaeaea] transition-colors">Back</button>
                  <button
                    onClick={handleSubmit}
                    disabled={createUser.isPending}
                    className="flex-1 bg-foreground text-background py-3 rounded-full font-medium text-[14px] hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="btn-submit-profile"
                  >
                    {createUser.isPending ? "Creating…" : "Create profile"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
