import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useCreatePrompt, useListCategories } from "@workspace/api-client-react";
import { Terminal, Send, Lock, Globe, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreatePrompt() {
  const [, setLocation] = useLocation();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const createPrompt = useCreatePrompt();

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    description: "",
    categoryId: 0,
    tags: "",
    isPublic: true,
    authorUsername: "me" // Mock auth user
  });

  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!formData.title || !formData.content || formData.categoryId === 0) {
      setError("Title, content, and category are required.");
      return;
    }

    const payload = {
      ...formData,
      tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean)
    };

    createPrompt.mutate({ data: payload }, {
      onSuccess: (prompt) => {
        setLocation(`/prompt/${prompt.id}`);
      },
      onError: (err: any) => {
        setError("Failed to publish prompt. Ensure you have created a profile first.");
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Publish Prompt</h1>
            <p className="text-muted-foreground">List a new prompt on the marketplace.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-mono border border-border">
            <Terminal className="h-3.5 w-3.5" /> MARKET_WRITE
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Title & Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. System Prompt for Next.js App Generation"
                  className="w-full bg-card border border-border rounded-md py-2.5 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium placeholder:font-normal"
                  data-testid="input-prompt-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                <select 
                  value={formData.categoryId}
                  onChange={e => setFormData({...formData, categoryId: Number(e.target.value)})}
                  className="w-full bg-card border border-border rounded-md py-2.5 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                  data-testid="select-prompt-category"
                >
                  <option value={0} disabled>Select a category...</option>
                  {categoriesLoading ? (
                     <option disabled>Loading...</option>
                  ) : categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prompt Content</label>
                <span className="text-[10px] font-mono text-muted-foreground uppercase bg-secondary px-1.5 rounded">Markdown Supported</span>
              </div>
              <textarea 
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                placeholder="You are an expert developer..."
                className="w-full bg-[#0A0A0A] border border-border rounded-md py-4 px-4 text-sm font-mono text-[#E5E5E5] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[300px] resize-y"
                data-testid="input-prompt-content"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Explain what this prompt does best and how to use it..."
                className="w-full bg-card border border-border rounded-md py-2.5 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[100px] resize-none"
                data-testid="input-prompt-description"
              />
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 border-b border-border/50 pb-3">Metadata</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Tags</label>
                  <input 
                    type="text" 
                    value={formData.tags}
                    onChange={e => setFormData({...formData, tags: e.target.value})}
                    placeholder="react, coding, system (comma separated)"
                    className="w-full bg-background border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:border-primary"
                    data-testid="input-prompt-tags"
                  />
                </div>

                <div className="pt-4 border-t border-border/50">
                  <label className="text-xs font-semibold text-muted-foreground mb-3 block">Visibility</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setFormData({...formData, isPublic: true})}
                      className={`flex flex-col items-center justify-center p-3 rounded-md border transition-all ${formData.isPublic ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                    >
                      <Globe className="h-5 w-5 mb-1.5" />
                      <span className="text-xs font-medium">Public</span>
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, isPublic: false})}
                      className={`flex flex-col items-center justify-center p-3 rounded-md border transition-all ${!formData.isPublic ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                    >
                      <Lock className="h-5 w-5 mb-1.5" />
                      <span className="text-xs font-medium">Private</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={createPrompt.isPending}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-md font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,200,5,0.2)] hover:shadow-[0_0_25px_rgba(0,200,5,0.3)] disabled:opacity-50 disabled:shadow-none"
              data-testid="btn-publish-prompt"
            >
              {createPrompt.isPending ? <Terminal className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {createPrompt.isPending ? "Publishing..." : "Publish to Market"}
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
