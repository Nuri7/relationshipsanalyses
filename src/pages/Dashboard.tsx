import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Network, Upload, LogOut, Clock, Users, MessageCircle, Trash2, Home, Handshake, Briefcase, FolderSync, Share2, Copy, Check, Link as LinkIcon, Smartphone } from "lucide-react";
import { format } from "date-fns";

interface ChatUpload {
  id: string;
  filename: string;
  status: string;
  message_count: number;
  participant_count: number;
  created_at: string;
  error_message?: string;
  category?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<ChatUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    setUserName(profile?.display_name || user.email?.split("@")[0] || "User");

    const { data: uploadsData } = await supabase
      .from("chat_uploads")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: analysesData } = await supabase
      .from("chat_analyses")
      .select("upload_id, relationships");

    // Build a map of upload_id -> dominant relationship type
    const categoryMap = new Map<string, string>();
    if (analysesData) {
      for (const a of analysesData as any[]) {
        const rels = Array.isArray(a.relationships) ? a.relationships : [];
        if (rels.length === 0) continue;
        // Count relationship types and pick the most common
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

    const enriched = ((uploadsData as any[]) || []).map((u) => ({
      ...u,
      category: u.category_override || categoryMap.get(u.id) || "uncategorized",
    }));

    setUploads(enriched);
    setLoading(false);
  };

  const handleCategoryChange = async (uploadId: string, newCategory: string) => {
    const { error } = await supabase
      .from("chat_uploads")
      .update({ category_override: newCategory } as any)
      .eq("id", uploadId);
    if (error) {
      toast({ title: "Failed to update category", variant: "destructive" });
      return;
    }
    setUploads((prev) =>
      prev.map((u) => (u.id === uploadId ? { ...u, category: newCategory } : u))
    );
    toast({ title: `Moved to ${newCategory}` });
  };
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const { toast } = useToast();

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if a share already exists
      const { data: existing } = await supabase
        .from("dashboard_shares")
        .select("token")
        .eq("owner_id", user.id)
        .limit(1);

      let token: string;
      if (existing && existing.length > 0) {
        token = (existing[0] as any).token;
      } else {
        const { data, error } = await supabase
          .from("dashboard_shares")
          .insert({ owner_id: user.id } as any)
          .select("token")
          .single();
        if (error) throw error;
        token = (data as any).token;
      }

      setShareLink(`${window.location.origin}/shared/${token}`);
    } catch (err: any) {
      toast({ title: "Failed to create share link", description: err.message, variant: "destructive" });
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({ title: "Link copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (e: React.MouseEvent, uploadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Delete analysis first (foreign key)
      await supabase.from("chat_analyses").delete().eq("upload_id", uploadId);
      const { error } = await supabase.from("chat_uploads").delete().eq("id", uploadId);
      if (error) throw error;
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      toast({ title: "Chat deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "error": return "destructive";
      case "analyzing": return "secondary";
      default: return "outline";
    }
  };

  const UploadCard = ({ upload, navigate, handleDelete, statusColor }: { upload: ChatUpload; navigate: any; handleDelete: any; statusColor: any }) => (
    <div className="relative">
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => { if (upload.status === "completed") navigate(`/analysis/${upload.id}`); }}
      >
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
            <div className="flex items-center gap-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                    <FolderSync className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {[
                    { key: "family", label: "Family", icon: <Home className="mr-2 h-4 w-4" /> },
                    { key: "friends", label: "Friends", icon: <Handshake className="mr-2 h-4 w-4" /> },
                    { key: "professional", label: "Professional", icon: <Briefcase className="mr-2 h-4 w-4" /> },
                  ].map((cat) => (
                    <DropdownMenuItem
                      key={cat.key}
                      onClick={() => handleCategoryChange(upload.id, cat.key)}
                      className={upload.category === cat.key ? "bg-accent" : ""}
                    >
                      {cat.icon}{cat.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{upload.filename}" and its analysis.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => handleDelete(e, upload.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary overflow-hidden sm:h-10 sm:w-10">
              <img src="/favicon.png" alt="Logo" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">Relationship Analyzer</h1>
              <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-9 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary">
                  <Smartphone className="h-4 w-4" />
                  Get App
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md flex flex-col items-center justify-center py-10">
                <DialogHeader>
                  <DialogTitle className="text-center text-xl">Get the Mobile App</DialogTitle>
                  <DialogDescription className="text-center">
                    Open your phone's camera and scan this code to view and install the app on your mobile device.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm border">
                  <QRCodeSVG value={window.location.href} size={220} level="M" />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share your dashboard</DialogTitle>
                  <DialogDescription>
                    Anyone with this link can view your analyses after signing in.
                  </DialogDescription>
                </DialogHeader>
                {shareLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : shareLink ? (
                  <div className="flex items-center gap-2">
                    <Input value={shareLink} readOnly className="text-sm" />
                    <Button size="icon" variant="outline" onClick={handleCopyLink}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
            <Link to="/matrix">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Users className="mr-1 h-4 w-4" /> Matrix
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Users className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/feedback" className="hidden sm:block">
              <Button variant="ghost" size="sm">Feedback</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <h2 className="text-xl font-bold sm:text-2xl">Your Analyses</h2>
          <Link to="/upload">
            <Button size="sm">
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : uploads.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Network className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No chats analyzed yet</h3>
              <p className="mb-6 text-muted-foreground">Upload a WhatsApp chat export to get started</p>
              <Link to="/upload">
                <Button><Upload className="mr-2 h-4 w-4" /> Upload Your First Chat</Button>
              </Link>
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
                    "--cat-color": `hsl(${hsl})`,
                  } as React.CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2" style={{ color: `hsl(${hsl})` }}>
                    {icon}
                    <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>
                    <Badge className="ml-1 border-0" style={{ backgroundColor: `hsl(${hsl} / 0.15)`, color: `hsl(${hsl})` }}>{items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map((upload) => (
                      <UploadCard key={upload.id} upload={upload} navigate={navigate} handleDelete={handleDelete} statusColor={statusColor} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Uncategorized */}
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
                    {uncategorized.map((upload) => (
                      <UploadCard key={upload.id} upload={upload} navigate={navigate} handleDelete={handleDelete} statusColor={statusColor} />
                    ))}
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

export default Dashboard;
