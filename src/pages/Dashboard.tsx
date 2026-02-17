import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Upload, LogOut, Clock, Users, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface ChatUpload {
  id: string;
  filename: string;
  status: string;
  message_count: number;
  participant_count: number;
  created_at: string;
  error_message?: string;
}

const Dashboard = () => {
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

    const { data } = await supabase
      .from("chat_uploads")
      .select("*")
      .order("created_at", { ascending: false });

    setUploads((data as ChatUpload[]) || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "error": return "destructive";
      case "analyzing": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <MessageSquareText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Chat Analyzer</h1>
              <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/feedback">
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
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Analyses</h2>
          <Link to="/upload">
            <Button>
              <Upload className="mr-2 h-4 w-4" /> Upload Chat
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
              <MessageSquareText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No chats analyzed yet</h3>
              <p className="mb-6 text-muted-foreground">Upload a WhatsApp chat export to get started</p>
              <Link to="/upload">
                <Button><Upload className="mr-2 h-4 w-4" /> Upload Your First Chat</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <Link key={upload.id} to={upload.status === "completed" ? `/analysis/${upload.id}` : "#"}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{upload.filename}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(upload.created_at), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {upload.message_count} msgs
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {upload.participant_count}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusColor(upload.status) as any}>{upload.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
