import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetLibrary, getGetLibraryQueryKey } from "@workspace/api-client-react";
import { Database, Heart, Terminal, AlertTriangle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryDetail() {
  const { id } = useParams();
  const libraryId = Number(id);

  const { data: library, isLoading, isError } = useGetLibrary(libraryId, {
    query: {
      enabled: !!libraryId,
      queryKey: getGetLibraryQueryKey(libraryId)
    }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-4 py-12">
          <Skeleton className="h-8 w-24 mb-8" />
          <Skeleton className="h-16 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !library) {
    return (
      <Layout>
        <div className="container mx-auto max-w-5xl px-4 py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">This collection may have been removed or is private.</p>
          <Link href="/explore" className="text-primary hover:underline">Explore Marketplace</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-secondary/30 border-b border-border/50">
        <div className="container mx-auto max-w-5xl px-4 md:px-8 py-12">
          <Link href={`/profile/${library.authorUsername}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" /> Back to Creator
          </Link>
          
          <div className="flex items-center gap-3 mb-4 text-primary">
            <div className="bg-primary/10 p-2 rounded-md border border-primary/20">
              <Database className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold tracking-wider uppercase">Curated Collection</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{library.name}</h1>
          
          {library.description && (
            <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mb-6">
              {library.description}
            </p>
          )}

          <div className="flex items-center gap-6 text-sm text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <span className="font-sans font-medium text-foreground">Curator:</span>
              <Link href={`/profile/${library.authorUsername}`} className="hover:text-primary transition-colors">
                @{library.authorUsername}
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> {library.prompts.length} Prompts
            </div>
            <div className="flex items-center gap-1.5">
              Updated {new Date(library.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {library.prompts.length ? (
            library.prompts.map(prompt => (
              <Link key={prompt.id} href={`/prompt/${prompt.id}`} className="group block h-full">
                <div className="bg-card border border-border rounded-lg p-5 h-full flex flex-col hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs text-muted-foreground font-mono uppercase bg-secondary px-2 py-0.5 rounded">{prompt.categoryName}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Heart className="h-3 w-3 text-primary" /> {prompt.saveCount}
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">{prompt.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1 mb-4">{prompt.description}</p>
                  
                  <div className="bg-secondary/50 p-3 rounded text-xs font-mono text-muted-foreground line-clamp-2 overflow-hidden border border-border">
                    {prompt.content.substring(0, 100)}...
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-16 text-center border border-dashed border-border rounded-lg">
              <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-1">Empty Library</h3>
              <p className="text-sm text-muted-foreground">The creator hasn't added any prompts to this collection yet.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
