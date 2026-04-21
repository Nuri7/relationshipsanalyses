import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Network,
  Clock,
  Users,
  MessageCircle,
  ArrowLeft,
  Home,
  Handshake,
  Briefcase,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import type { Session } from "@supabase/supabase-js";

interface SharedUpload {
  id: string;
  filename: string;
  status: string;
  message_count: number;
  participant_count: number;
  created_at: string;
  category?: string;
}

const SharedDashboard = () => {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<SharedUpload[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !token) return;
    loadSharedData();
  }, [session, token]);

  const loadSharedData = async () => {
    setLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-shared-dashboard?token=${encodeURIComponent(token!)}`,
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "This share link is invalid or has been revoked.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOwnerName(data.ownerName);

      // Build category map from analyses
      const categoryMap = new Map<string, string>();
      if (data.analyses) {
        for (const a of data.analyses) {
          const rels = Array.isArray(a.relationships) ? a.relationships : [];
          if (rels.length === 0) continue;
          const counts: Record<string, number> = {};
          for (const r of rels) {
            const t = (r.type || "other").toLowerCase();
            const mapped = t === "romantic" ? "friends" : t === "acquaintances" ? "friends" : t;
            counts[mapped] = (counts[mapped] || 0) + 1;
          }
          const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "friends";
          categoryMap.set(a.upload_id, dominant);
        }
      }

      const enriched = (data.uploads || []).map((u: any) => ({
        ...u,
        category: u.category_override || categoryMap.get(u.id) || "uncategorized",
      }));

      setUploads(enriched);
    } catch (err: any) {
      setError("Failed to load shared dashboard.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    sessionStorage.setItem("redirect_after_auth", `/shared/${token}`);
    return <Navigate to="/auth" replace />;
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "error": return "destructive";
      case "analyzing": return "secondary";
      default: return "outline";
    }
  };

  const ReadOnlyCard = ({ upload }: { upload: SharedUpload }) => (
    <Card className={upload.status === "completed" ? "cursor-pointer transition-shadow hover:shadow-md" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{upload.filename}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(upload.created_at), "MMM d")}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{upload.message_count}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{upload.participant_count}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between pl-[52px]">
          <Badge variant={statusColor(upload.status) as any} className="text-xs">{upload.status}</Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Eye className="h-3 w-3" /> View only
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary overflow-hidden sm:h-10 sm:w-10">
              <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="Logo" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">Shared Dashboard</h1>
              <p className="text-xs text-muted-foreground">{ownerName}'s analyses</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> My Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {error ? (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Network className="mb-4 h-12 w-12 text-destructive" />
              <h3 className="mb-2 text-lg font-medium">Link not found</h3>
              <p className="mb-6 text-muted-foreground">{error}</p>
              <Link to="/">
                <Button><ArrowLeft className="mr-2 h-4 w-4" /> Go to my dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : uploads.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Network className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No analyses yet</h3>
              <p className="text-muted-foreground">This user hasn't uploaded any chats yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {[
              { key: "family", label: "Family", icon: <Home className="h-5 w-5" />, hsl: "var(--category-family)" },
              { key: "friends", label: "Friends", icon: <Handshake className="h-5 w-5" />, hsl: "var(--category-friends)" },
              { key: "professional", label: "Professional", icon: <Briefcase className="h-5 w-5" />, hsl: "var(--category-professional)" },
            ].map(({ key, label, icon, hsl }) => {
              const items = uploads.filter((u) => u.category === key);
              if (items.length === 0) return null;
              return (
                <div
                  key={key}
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: `hsl(${hsl} / 0.25)` as any,
                    backgroundColor: `hsl(${hsl} / 0.04)` as any,
                  } as React.CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2" style={{ color: `hsl(${hsl})` }}>
                    {icon}
                    <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>
                    <Badge className="ml-1 border-0" style={{ backgroundColor: `hsl(${hsl} / 0.15)`, color: `hsl(${hsl})` }}>{items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map((upload) => <ReadOnlyCard key={upload.id} upload={upload} />)}
                  </div>
                </div>
              );
            })}
            {(() => {
              const uncategorized = uploads.filter((u) => u.category === "uncategorized");
              if (uncategorized.length === 0) return null;
              const hsl = "var(--category-other)";
              return (
                <div className="rounded-2xl border p-5" style={{ borderColor: `hsl(${hsl} / 0.25)`, backgroundColor: `hsl(${hsl} / 0.04)` }}>
                  <div className="mb-4 flex items-center gap-2" style={{ color: `hsl(${hsl})` }}>
                    <Users className="h-5 w-5" />
                    <h3 className="text-sm font-bold uppercase tracking-wide">Other</h3>
                    <Badge className="ml-1 border-0" style={{ backgroundColor: `hsl(${hsl} / 0.15)`, color: `hsl(${hsl})` }}>{uncategorized.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {uncategorized.map((upload) => <ReadOnlyCard key={upload.id} upload={upload} />)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedDashboard;
