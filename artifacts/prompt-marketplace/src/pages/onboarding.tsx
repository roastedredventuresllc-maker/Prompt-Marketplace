import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useCreateUser, useListCategories } from "@workspace/api-client-react";
import { Terminal, Check, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const createUser = useCreateUser();

  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    bio: "",
    categories: [] as string[]
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

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(id) 
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id]
    }));
  };

  const handleSubmit = () => {
    setError("");
    createUser.mutate({ data: formData }, {
      onSuccess: (user) => {
        setLocation(`/profile/${user.username}`);
      },
      onError: () => {
        setError("Failed to create profile. Username might be taken.");
      }
    });
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[calc(100vh-160px)]">
        <div className="w-full max-w-md">
          
          <div className="mb-8 flex items-center justify-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step === s ? 'border-primary bg-primary/10 text-primary' : 
                  step > s ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                }`}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="bg-card border border-border p-8 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
            
            {error && (
              <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md text-center">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Claim Your Identity</h2>
                  <p className="text-muted-foreground text-sm">Join the highest-signal marketplace for AI creators.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">@</span>
                      <input 
                        type="text" 
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')})}
                        placeholder="creator_name"
                        className="w-full bg-background border border-border rounded-md py-2.5 pl-8 pr-4 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        data-testid="input-username"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display Name</label>
                    <input 
                      type="text" 
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      placeholder="Your Name"
                      className="w-full bg-background border border-border rounded-md py-2.5 px-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      data-testid="input-display-name"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleNext}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-8"
                  data-testid="btn-next-1"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">What do you build?</h2>
                  <p className="text-muted-foreground text-sm">Select domains you specialize in. (Choose at least 1)</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {categoriesLoading ? (
                    Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)
                  ) : categories?.map(cat => {
                    const isSelected = formData.categories.includes(cat.slug);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.slug)}
                        className={`text-left p-3 rounded-md border text-sm font-medium transition-all ${
                          isSelected 
                            ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(0,200,5,0.1)]' 
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                        data-testid={`btn-select-${cat.slug}`}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setStep(1)} className="px-4 py-3 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors">
                    Back
                  </button>
                  <button 
                    onClick={handleNext}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    data-testid="btn-next-2"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Final Polish</h2>
                  <p className="text-muted-foreground text-sm">Add a bio to tell the market who you are.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio (Optional)</label>
                  <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    placeholder="I build prompts for advanced logical reasoning..."
                    className="w-full bg-background border border-border rounded-md py-3 px-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[120px] resize-none"
                    data-testid="input-bio"
                  />
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setStep(2)} className="px-4 py-3 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors" disabled={createUser.isPending}>
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={createUser.isPending}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    data-testid="btn-submit-profile"
                  >
                    {createUser.isPending ? <Terminal className="h-4 w-4 animate-spin" /> : "Complete Profile"}
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
