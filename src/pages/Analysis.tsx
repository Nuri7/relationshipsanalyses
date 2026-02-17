import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Download, Users, Heart, Briefcase, Home, UserCircle,
  Edit, Save, X, Eye, EyeOff, Share2
} from "lucide-react";

interface Characteristic {
  name: string;
  traits: string[];
  description: string;
  messageCount?: number;
  topEmojis?: string[];
  dominantTone?: string;
}

interface Relationship {
  person1: string;
  person2: string;
  type: string;
  strength: number;
  description: string;
}

interface Analysis {
  id: string;
  upload_id: string;
  summary: string;
  characteristics: Characteristic[];
  relationships: Relationship[];
  participants: string[];
  anonymized: boolean;
  anonymized_map: Record<string, string>;
}

const relationshipIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "friends": return <Heart className="h-4 w-4" />;
    case "professional": return <Briefcase className="h-4 w-4" />;
    case "family": return <Home className="h-4 w-4" />;
    default: return <Users className="h-4 w-4" />;
  }
};

const AnalysisPage = () => {
  const { uploadId } = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [anonymized, setAnonymized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalysis();
  }, [uploadId]);

  const loadAnalysis = async () => {
    const { data: uploadData } = await supabase
      .from("chat_uploads")
      .select("*")
      .eq("id", uploadId)
      .single();

    const { data: analysisData } = await supabase
      .from("chat_analyses")
      .select("*")
      .eq("upload_id", uploadId)
      .single();

    setUpload(uploadData);
    if (analysisData) {
      const a = analysisData as any;
      setAnalysis({
        ...a,
        characteristics: Array.isArray(a.characteristics) ? a.characteristics : [],
        relationships: Array.isArray(a.relationships) ? a.relationships : [],
        participants: Array.isArray(a.participants) ? a.participants : [],
        anonymized_map: a.anonymized_map || {},
      });
      setAnonymized(a.anonymized || false);
    }
    setLoading(false);
  };

  const getDisplayName = (name: string) => {
    if (!anonymized || !analysis) return name;
    if (!analysis.anonymized_map[name]) {
      const idx = analysis.participants.indexOf(name);
      return `Person ${String.fromCharCode(65 + (idx >= 0 ? idx : 0))}`;
    }
    return analysis.anonymized_map[name];
  };

  const toggleAnonymize = async () => {
    if (!analysis) return;
    const newVal = !anonymized;
    setAnonymized(newVal);

    const nameMap: Record<string, string> = {};
    analysis.participants.forEach((name, i) => {
      nameMap[name] = `Person ${String.fromCharCode(65 + i)}`;
    });

    await supabase
      .from("chat_analyses")
      .update({ anonymized: newVal, anonymized_map: nameMap })
      .eq("id", analysis.id);
  };

  const saveSummary = async () => {
    if (!analysis) return;
    await supabase.from("chat_analyses").update({ summary: summaryDraft }).eq("id", analysis.id);
    setAnalysis({ ...analysis, summary: summaryDraft });
    setEditingSummary(false);
    toast({ title: "Summary updated" });
  };

  const exportPDF = () => {
    if (!analysis) return;
    // Create printable HTML and use browser print
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const chars = analysis.characteristics
      .map((c) => `<div style="margin-bottom:16px;padding:12px;border:1px solid #ddd;border-radius:8px;">
        <h3 style="margin:0 0 8px">${getDisplayName(c.name)}</h3>
        <p style="color:#666;margin:4px 0">Traits: ${c.traits.join(", ")}</p>
        <p style="margin:4px 0">${c.description}</p>
      </div>`).join("");

    const rels = analysis.relationships
      .map((r) => `<div style="margin-bottom:12px;padding:12px;border:1px solid #ddd;border-radius:8px;">
        <strong>${getDisplayName(r.person1)} ↔ ${getDisplayName(r.person2)}</strong>
        <span style="margin-left:8px;padding:2px 8px;background:#f0f0f0;border-radius:12px;font-size:12px">${r.type}</span>
        <p style="color:#666;margin:8px 0 0">${r.description}</p>
      </div>`).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Chat Analysis - ${upload?.filename}</title>
      <style>body{font-family:system-ui;max-width:700px;margin:40px auto;padding:0 20px;color:#333}
      h1{color:#5b3cc4}h2{border-bottom:2px solid #5b3cc4;padding-bottom:8px;margin-top:32px}</style></head>
      <body>
      <h1>Chat Analysis</h1><p style="color:#666">${upload?.filename} • ${upload?.message_count} messages</p>
      <h2>Summary</h2><div>${analysis.summary?.replace(/\n/g, "<br>") || "No summary"}</div>
      <h2>Participant Profiles</h2>${chars}
      <h2>Relationships</h2>${rels}
      <script>window.print()</script></body></html>`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Analysis not found or still processing.</p>
        <Link to="/"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold">{upload?.filename}</h1>
              <p className="text-xs text-muted-foreground">{upload?.message_count} messages • {analysis.participants.length} participants</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {anonymized ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <Label htmlFor="anon" className="text-sm">Anonymize</Label>
              <Switch id="anon" checked={anonymized} onCheckedChange={toggleAnonymize} />
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="summary">
          <TabsList className="mb-6 w-full justify-start">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Conversation Summary</CardTitle>
                {!editingSummary ? (
                  <Button variant="ghost" size="sm" onClick={() => { setSummaryDraft(analysis.summary || ""); setEditingSummary(true); }}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingSummary(false)}><X className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={saveSummary}><Save className="mr-2 h-4 w-4" /> Save</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editingSummary ? (
                  <Textarea
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    className="min-h-[200px]"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                    {analysis.summary || "No summary available."}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profiles Tab */}
          <TabsContent value="profiles">
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.characteristics.map((char, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{getDisplayName(char.name)}</CardTitle>
                        {char.dominantTone && (
                          <CardDescription>{char.dominantTone}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {char.traits.map((trait, j) => (
                        <Badge key={j} variant="secondary">{trait}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{char.description}</p>
                    {char.topEmojis && char.topEmojis.length > 0 && (
                      <p className="text-sm">Top emojis: {char.topEmojis.join(" ")}</p>
                    )}
                    {char.messageCount && (
                      <p className="text-xs text-muted-foreground">{char.messageCount} messages</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Relationships Tab */}
          <TabsContent value="relationships">
            <div className="space-y-4">
              {analysis.relationships.map((rel, i) => (
                <Card key={i}>
                  <CardContent className="flex items-start gap-4 py-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      {relationshipIcon(rel.type)}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{getDisplayName(rel.person1)}</span>
                        <Share2 className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold">{getDisplayName(rel.person2)}</span>
                        <Badge variant="outline" className="ml-auto">{rel.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rel.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Strength:</span>
                        <div className="h-2 w-24 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(rel.strength / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{rel.strength}/10</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {analysis.relationships.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No relationships detected.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AnalysisPage;
