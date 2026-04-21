import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { parseGenericChat, generateChatStats, ChatStats, type ParsedMessage } from "@/lib/chatParser";
import ChatBubbleViewer from "@/components/ChatBubbleViewer";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Download, Users, Heart, Briefcase, Home, UserCircle,
  Edit, Save, X, Eye, EyeOff, Share2, Flame, Moon, Ghost, Mic, Trophy, MessageCircle
} from "lucide-react";

interface Characteristic {
  name: string;
  traits: string[];
  description: string;
  archetype?: string;
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
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [chatMessages, setChatMessages] = useState<ParsedMessage[]>([]);
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
    
    // Load custom chat stats
    if (uploadData && uploadData.file_path) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("chat-files")
          .download(uploadData.file_path);
        
        if (!downloadError && fileData) {
          const text = await fileData.text();
          const parsed = parseGenericChat(text);
          const stats = generateChatStats(parsed.messages);
          setChatStats(stats);
          setChatMessages(parsed.messages);
        }
      } catch (err) {
        console.error("Failed to load chat stats", err);
      }
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

  const exportSocialCard = async () => {
    const cardElement = document.getElementById("social-export-card");
    if (!cardElement) return;
    
    // Temporarily make it visible
    cardElement.style.display = "flex";
    
    try {
      toast({ title: "Generating Export...", description: "Please wait a moment." });
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        backgroundColor: "#121212", // dark mode fallback
        useCORS: true,
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `relationship-analyzer-${upload?.filename || "export"}.png`;
      link.click();
      
      toast({ title: "Exported successfully!", description: "Image saved to your device." });
    } catch (err) {
      console.error(err);
      toast({ title: "Export failed", variant: "destructive", description: "Could not generate screenshot." });
    } finally {
      // Hide again
      cardElement.style.display = "none";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden Export Card for html2canvas */}
      {chatStats && (
        <div 
          id="social-export-card" 
          className="w-[1080px] h-[1920px] bg-card text-card-foreground absolute -left-[9999px] flex flex-col justify-center items-center p-24 font-sans border-8 border-primary rounded-[3rem]"
          style={{ display: "none" }}
        >
          <div className="flex-1 w-full flex flex-col items-center justify-center space-y-12">
            <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent text-center leading-tight">
              {upload?.filename?.replace('.txt', '').replace('.zip', '')}
            </h1>
            <p className="text-4xl text-muted-foreground">Relationship Analysis Insights</p>
            
            <div className="w-full bg-muted/50 rounded-3xl p-12 mt-12 space-y-8">
              <h2 className="text-5xl font-semibold mb-8 border-b pb-8">The Dynamics</h2>
              {analysis.participants.map((p, i) => {
                const char = analysis.characteristics.find(c => getDisplayName(c.name) === getDisplayName(p));
                const words = chatStats.participantStats[p]?.wordCount || 0;
                const totalWords = analysis.participants.reduce((a, name) => a + (chatStats.participantStats[name]?.wordCount || 0), 0);
                const perc = totalWords > 0 ? (words / totalWords) * 100 : 0;
                
                return (
                  <div key={p} className="flex justify-between items-center bg-background rounded-2xl p-8 shadow-sm">
                    <div>
                      <h3 className="text-4xl font-bold" style={{ color: `hsl(var(--chart-${(i % 5) + 1}))` }}>{getDisplayName(p)}</h3>
                      {char?.archetype && <p className="text-3xl text-muted-foreground mt-2">{char.archetype}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black">{perc.toFixed(0)}% <span className="text-2xl font-normal text-muted-foreground">Effort</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="w-full bg-primary/10 rounded-3xl p-12 mt-12">
              <h2 className="text-5xl font-semibold mb-8 text-primary">Hall of Fame</h2>
              <div className="space-y-6 text-3xl italic">
                {analysis.summary.split('\n').filter(l => l.includes('"')).slice(0, 3).map((l, i) => (
                  <p key={i} className="pl-6 border-l-8 border-primary">{l}</p>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-3xl font-bold tracking-widest text-muted-foreground uppercase opacity-50">
            Powered by Relationship Analyzer
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold">{upload?.filename}</h1>
              <p className="text-xs text-muted-foreground">{upload?.message_count} messages • {analysis.participants.length} participants</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              {anonymized ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <Label htmlFor="anon" className="text-sm">Anonymize</Label>
              <Switch id="anon" checked={anonymized} onCheckedChange={toggleAnonymize} />
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Button size="sm" onClick={exportSocialCard}>
              <Share2 className="mr-2 h-4 w-4" /> Export Card
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="summary">
          <div className="relative mb-6">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 sm:hidden" />
            <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
              <TabsTrigger value="relationships">Relationships</TabsTrigger>
              <TabsTrigger value="effort">Effort</TabsTrigger>
              <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
              <TabsTrigger value="vibes">Vibes & Words</TabsTrigger>
              <TabsTrigger value="conversation" className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> Chat
              </TabsTrigger>
              <TabsTrigger value="habits">Habits</TabsTrigger>
              <TabsTrigger value="awards">Awards</TabsTrigger>
            </TabsList>
          </div>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {chatStats?.firstMessage && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-primary flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🌅</span> The Very First Text
                    </div>
                    {chatStats.firstSparkResponseTimeMin !== null && (
                      <Badge variant="outline" className="bg-background">
                        First reply took {chatStats.firstSparkResponseTimeMin < 60 
                          ? `${Math.round(chatStats.firstSparkResponseTimeMin)} min` 
                          : `${Math.round(chatStats.firstSparkResponseTimeMin / 60)} hrs`}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {new Date(chatStats.firstMessage.timestamp).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <blockquote className="border-l-4 border-primary pl-4 text-xl italic font-serif my-2 text-foreground">
                      "{chatStats.firstMessage.content}"
                    </blockquote>
                    <span className="text-sm font-bold text-foreground">— {getDisplayName(chatStats.firstMessage.sender)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {chatStats?.marathonDate && (
              <Card className="border-accent/50 bg-accent/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-accent flex items-center gap-2">
                    <span className="text-2xl">🏃</span> The Marathon Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">
                    On <span className="font-bold">{new Date(chatStats.marathonDate.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>, you exchanged a massive <span className="font-bold text-accent">{chatStats.marathonDate.count}</span> messages!
                  </p>
                </CardContent>
              </Card>
            )}

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
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                    <ReactMarkdown>{analysis.summary || "No summary available."}</ReactMarkdown>
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
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{getDisplayName(char.name)}</CardTitle>
                        <CardDescription className="flex flex-col gap-1 mt-1">
                          {char.archetype && (
                            <span className="font-semibold text-primary">{char.archetype}</span>
                          )}
                          {char.dominantTone && (
                            <span>{char.dominantTone}</span>
                          )}
                          {chatStats?.participantStats[char.name]?.avgResponseTimeMin !== undefined && (
                            <div className="flex flex-col gap-1.5 mt-2 rounded-md bg-muted/30 p-3">
                              <span className="text-xs font-medium text-muted-foreground flex justify-between">
                                <span>💬 Avg Words/Msg:</span>
                                <span>{Math.round(chatStats.participantStats[char.name].wordCount / chatStats.participantStats[char.name].messageCount) || 0}</span>
                              </span>
                              <span className="text-xs font-medium text-muted-foreground flex justify-between">
                                <span>⏱️ Response Time:</span>
                                <span>{Math.round(chatStats.participantStats[char.name].avgResponseTimeMin)} min</span>
                              </span>
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex justify-between">
                                <span>🙏 Apologies:</span>
                                <span>{chatStats.participantStats[char.name].apologies || 0}</span>
                              </span>
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex justify-between">
                                <span>🤬 Profanity:</span>
                                <span>{chatStats.participantStats[char.name].swears || 0}</span>
                              </span>
                            </div>
                          )}
                        </CardDescription>
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

          {/* Visualizations Tab */}
          <TabsContent value="visualizations">
            {!chatStats ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <p>Processing chat statistics...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Flow</CardTitle>
                    <CardDescription>Message volume across the duration of your chats.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chatStats.timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          {analysis.participants.map((p, i) => (
                            <linearGradient key={p} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={`hsl(var(--chart-${(i % 5) + 1}))`} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={`hsl(var(--chart-${(i % 5) + 1}))`} stopOpacity={0}/>
                            </linearGradient>
                          ))}
                        </defs>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                        <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                        {analysis.participants.map((p, i) => (
                          <Area key={p} type="monotone" dataKey={`counts.${p}`} name={getDisplayName(p)} stroke={`hsl(var(--chart-${(i % 5) + 1}))`} fillOpacity={1} fill={`url(#color${i})`} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Conversation Initiators</CardTitle>
                      <CardDescription>Who breaks the silence most often (12h+ gaps).</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analysis.participants.map(p => ({
                              name: getDisplayName(p),
                              value: chatStats.participantStats[p]?.initiatorCount || 0
                            })).filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {analysis.participants.map((p, index) => (
                              <Cell key={`cell-i-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity by Hour</CardTitle>
                      <CardDescription>Night owls vs early birds.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chatStats.hourlyHeatmap} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                          {analysis.participants.map((p, index) => (
                            <Bar key={p} dataKey={`counts.${p}`} name={getDisplayName(p)} stackId="a" fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Effort Tab */}
          <TabsContent value="effort">
            {!chatStats ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <p>Processing chat statistics...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Percentage of Effort</CardTitle>
                    <CardDescription>Relative speaking volume based on total word count.</CardDescription>
                  </CardHeader>
                <CardContent>
                  <div className="grid gap-8 md:grid-cols-2">
                    {/* Progress Bars */}
                    <div className="flex flex-col justify-center space-y-6">
                      {(() => {
                        const totalWords = analysis.participants.reduce((acc, p) => acc + (chatStats.participantStats[p]?.wordCount || 0), 0);
                        
                        const sortedParticipants = [...analysis.participants].sort(
                          (a, b) => (chatStats.participantStats[b]?.wordCount || 0) - (chatStats.participantStats[a]?.wordCount || 0)
                        );
                        
                        return sortedParticipants.map((p, i) => {
                          const count = chatStats.participantStats[p]?.wordCount || 0;
                          const percentage = totalWords > 0 ? (count / totalWords) * 100 : 0;
                          const chartColor = `hsl(var(--chart-${(analysis.participants.indexOf(p) % 5) + 1}))`;
                          
                          return (
                            <div key={p} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 font-semibold">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: chartColor }} />
                                  {getDisplayName(p)}
                                </span>
                                <span className="font-medium text-muted-foreground">{percentage.toFixed(1)}% ({count.toLocaleString()} words)</span>
                              </div>
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
                                <div 
                                  className="h-full rounded-full transition-all duration-500 ease-in-out" 
                                  style={{ 
                                    width: `${percentage}%`, 
                                    backgroundColor: chartColor 
                                  }} 
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Pie Chart */}
                    <div className="h-64 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analysis.participants.map(p => ({
                              name: getDisplayName(p),
                              value: chatStats.participantStats[p]?.wordCount || 0
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {analysis.participants.map((p, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>The "Double Texter"</CardTitle>
                    <CardDescription>Who sends 3+ messages in a row without a reply.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.participants.map((p, i) => {
                      const maxDouble = Math.max(...analysis.participants.map(name => chatStats.participantStats[name]?.doubleTexts || 0));
                      const myDouble = chatStats.participantStats[p]?.doubleTexts || 0;
                      const percentage = maxDouble > 0 ? (myDouble / maxDouble) * 100 : 0;
                      
                      return (
                        <div key={p} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold">{getDisplayName(p)}</span>
                            <span className="text-muted-foreground">{myDouble} times</span>
                          </div>
                          <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content Curator</CardTitle>
                    <CardDescription>Who shares the most links/media.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.participants.map((p, i) => {
                      const maxLinks = Math.max(...analysis.participants.map(name => chatStats.participantStats[name]?.linkShares || 0));
                      const myLinks = chatStats.participantStats[p]?.linkShares || 0;
                      const percentage = maxLinks > 0 ? (myLinks / maxLinks) * 100 : 0;
                      
                      return (
                        <div key={p} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold">{getDisplayName(p)}</span>
                            <span className="text-muted-foreground">{myLinks} links</span>
                          </div>
                          <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
            )}
          </TabsContent>

          {/* Vibes Tab */}
          <TabsContent value="vibes">
            {!chatStats ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Heart className="text-rose-500 h-5 w-5" /> Affection vs <Flame className="text-orange-500 h-5 w-5" /> Spice</CardTitle>
                      <CardDescription>Ratio of sweet words to spicy/angry words.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {analysis.participants.map(p => {
                        const sweet = chatStats.participantStats[p]?.sweetWords || 0;
                        const spicy = chatStats.participantStats[p]?.spicyWords || 0;
                        const total = sweet + spicy;
                        const sweetPerc = total > 0 ? (sweet / total) * 100 : 50;
                        const spicyPerc = total > 0 ? (spicy / total) * 100 : 50;
                        
                        return (
                          <div key={p} className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                              <span className="text-rose-500">{sweet} Sweet</span>
                              <span className="font-bold">{getDisplayName(p)}</span>
                              <span className="text-orange-500">{spicy} Spicy</span>
                            </div>
                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                              <div className="bg-rose-500 transition-all" style={{ width: `${sweetPerc}%` }} />
                              <div className="bg-orange-500 transition-all" style={{ width: `${spicyPerc}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>🙏 The Gratitude Meter</CardTitle>
                      <CardDescription>Who says "Thank You" the most?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.participants.map((p, i) => {
                        const gratitude = chatStats.participantStats[p]?.gratitude || 0;
                        const maxGratitude = Math.max(...analysis.participants.map(name => chatStats.participantStats[name]?.gratitude || 0));
                        const perc = maxGratitude > 0 ? (gratitude / maxGratitude) * 100 : 0;
                        return (
                          <div key={p} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-semibold">{getDisplayName(p)}</span>
                              <span className="text-muted-foreground">{gratitude} times</span>
                            </div>
                            <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                              <div className="h-full rounded-full transition-all" style={{ width: `${perc}%`, backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Emojis</CardTitle>
                    <CardDescription>Signature emojis per person.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {analysis.participants.map(p => {
                        const top = chatStats.participantStats[p]?.topEmojis || [];
                        return (
                          <div key={p} className="flex flex-col items-center p-6 border rounded-2xl bg-muted/20">
                            <span className="font-bold mb-4">{getDisplayName(p)}</span>
                            <div className="flex gap-4">
                              {top.length > 0 ? top.map((t, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                  <span className="text-4xl">{t.emoji}</span>
                                  <span className="text-xs text-muted-foreground">{t.count}x</span>
                                </div>
                              )) : (
                                <span className="text-muted-foreground text-sm">No emojis used</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Habits Tab */}
          <TabsContent value="habits">
            {!chatStats ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Moon className="text-indigo-400 h-5 w-5" /> Late Night Talker</CardTitle>
                    <CardDescription>Messages sent between 12 AM and 5 AM.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {[...analysis.participants]
                      .sort((a, b) => {
                        const aMsg = chatStats.participantStats[a]?.lateNightMessages || 0;
                        const bMsg = chatStats.participantStats[b]?.lateNightMessages || 0;
                        return bMsg - aMsg;
                      })
                      .map((p, i) => {
                        const msgs = chatStats.participantStats[p]?.lateNightMessages || 0;
                        return (
                          <div key={p} className="flex items-center justify-between border-b pb-2 last:border-0">
                            <span className="font-medium">{getDisplayName(p)}</span>
                            <Badge variant={i === 0 ? "default" : "secondary"}>{msgs} msgs</Badge>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Ghost className="text-slate-400 h-5 w-5" /> The Ghoster</CardTitle>
                    <CardDescription>Gaps of over 24 hours before replying.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {analysis.participants.map((p, i) => {
                      const ghosts = chatStats.participantStats[p]?.ghostingCount || 0;
                      return (
                        <div key={p} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <span className="font-medium">{getDisplayName(p)}</span>
                          <span className="text-2xl font-bold">{ghosts}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mic className="text-green-500 h-5 w-5" /> Voice Notes</CardTitle>
                    <CardDescription>Who prefers talking over typing?</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {analysis.participants.map((p, i) => {
                      const vn = chatStats.participantStats[p]?.voiceNotes || 0;
                      return (
                        <div key={p} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <span className="font-medium">{getDisplayName(p)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold">{vn}</span>
                            <Mic className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Awards Tab */}
          <TabsContent value="awards">
            {!chatStats ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {(() => {
                  // Superlatives Logic
                  const participants = analysis.participants;
                  const stats = chatStats.participantStats;
                  const getWinner = (metricFn: (p: string) => number) => {
                    let bestP = participants[0];
                    let bestV = metricFn(bestP);
                    for (const p of participants) {
                      const v = metricFn(p);
                      if (v > bestV) { bestV = v; bestP = p; }
                    }
                    return { winner: bestP, value: bestV };
                  };

                  const novelist = getWinner(p => stats[p] ? stats[p].wordCount / Math.max(stats[p].messageCount, 1) : 0);
                  const machineGunner = getWinner(p => stats[p]?.doubleTexts || 0);
                  // Multi-Tasker is the one with lowest average response time (fastest)
                  const multiTasker = (() => {
                    let bestP = participants[0];
                    let bestV = stats[bestP]?.avgResponseTimeMin || Infinity;
                    for (const p of participants) {
                      const v = stats[p]?.avgResponseTimeMin;
                      if (v && v < bestV) { bestV = v; bestP = p; }
                    }
                    return { winner: bestP, value: bestV };
                  })();
                  const influencer = getWinner(p => stats[p]?.linkShares || 0);

                  const awards = [
                    { title: "The Novelist ✍️", desc: "Longest average message length", p: novelist.winner, detail: `${Math.round(novelist.value)} words/msg` },
                    { title: "The Machine Gunner 🔫", desc: "Highest number of double/triple texts", p: machineGunner.winner, detail: `${machineGunner.value} times` },
                    { title: "The Multi-Tasker ⚡", desc: "Fastest average response time", p: multiTasker.winner, detail: `${Math.round(multiTasker.value)} min` },
                    { title: "The Influencer 🔗", desc: "Most links and media shared", p: influencer.winner, detail: `${influencer.value} links` },
                  ];

                  return awards.map((a, i) => (
                    <Card key={i} className="bg-gradient-to-br from-card to-muted border-primary/20 shadow-md">
                      <CardHeader className="text-center pb-2">
                        <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                        <CardTitle className="text-2xl">{a.title}</CardTitle>
                        <CardDescription>{a.desc}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent my-4">
                          {getDisplayName(a.p)}
                        </div>
                        <Badge variant="outline" className="text-lg px-4 py-1">{a.detail}</Badge>
                      </CardContent>
                    </Card>
                  ));
                })()}
              </div>
            )}
          </TabsContent>

          {/* Conversation Tab */}
          <TabsContent value="conversation">
            {chatMessages.length > 0 ? (
              <ChatBubbleViewer
                messages={chatMessages}
                participants={analysis.participants}
                chatName={upload?.filename?.replace('.txt', '').replace('.zip', '') || 'Chat'}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p>Loading conversation...</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AnalysisPage;
