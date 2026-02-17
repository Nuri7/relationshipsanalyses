import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";

interface Relationship {
  person1: string;
  person2: string;
  type: string;
  strength: number;
  description: string;
}

interface Characteristic {
  name: string;
  traits: string[];
  description: string;
  messageCount?: number;
  topEmojis?: string[];
  dominantTone?: string;
}

interface ConnectionData {
  name: string;
  strength: number;
  type: string;
  description: string;
  userTone: string;
  userTraits: string[];
  userEmojis: string[];
  messageCount: number;
}

const COLORS = [
  "hsl(250, 65%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(340, 65%, 55%)",
  "hsl(45, 80%, 50%)",
  "hsl(200, 70%, 50%)",
  "hsl(290, 50%, 55%)",
];

const MyRelationships = () => {
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConnectionData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const displayName = profile?.display_name || user.email?.split("@")[0] || "";
    setUserName(displayName);

    const { data: analyses } = await supabase.from("chat_analyses").select("*");
    if (!analyses || !displayName) { setLoading(false); return; }

    // Find the user's name among participants (case-insensitive partial match)
    const lowerDisplay = displayName.toLowerCase();
    const connectionMap = new Map<string, ConnectionData>();

    for (const analysis of analyses) {
      const participants: string[] = Array.isArray(analysis.participants) ? analysis.participants as string[] : [];
      const chars: Characteristic[] = Array.isArray(analysis.characteristics) ? analysis.characteristics as any[] : [];
      const rels: Relationship[] = Array.isArray(analysis.relationships) ? analysis.relationships as any[] : [];

      // Identify which participant is the user
      const userParticipant = participants.find((p) => {
        const lp = p.toLowerCase();
        return lp.includes(lowerDisplay) || lowerDisplay.includes(lp);
      });

      if (!userParticipant) continue;

      // Get user's own characteristics in this chat
      const userChar = chars.find((c) => c.name === userParticipant);

      // For each relationship involving the user, build a connection
      for (const rel of rels) {
        const otherPerson =
          rel.person1 === userParticipant ? rel.person2 :
          rel.person2 === userParticipant ? rel.person1 : null;
        if (!otherPerson) continue;

        const existing = connectionMap.get(otherPerson);
        if (existing) {
          existing.strength = Math.max(existing.strength, rel.strength);
          if (userChar?.dominantTone && !existing.userTone) existing.userTone = userChar.dominantTone;
          if (userChar?.traits) existing.userTraits = [...new Set([...existing.userTraits, ...userChar.traits])];
          if (userChar?.topEmojis) existing.userEmojis = [...new Set([...existing.userEmojis, ...userChar.topEmojis])];
          existing.messageCount += userChar?.messageCount || 0;
        } else {
          connectionMap.set(otherPerson, {
            name: otherPerson,
            strength: rel.strength,
            type: rel.type,
            description: rel.description,
            userTone: userChar?.dominantTone || "",
            userTraits: userChar?.traits ? [...userChar.traits] : [],
            userEmojis: userChar?.topEmojis ? [...userChar.topEmojis] : [],
            messageCount: userChar?.messageCount || 0,
          });
        }
      }
    }

    const result = [...connectionMap.values()].sort((a, b) => b.strength - a.strength);
    setConnections(result);
    if (result.length > 0) setSelected(result[0]);
    setLoading(false);
  };

  // Build radar data: each axis = a person, value = strength
  const radarData = connections.map((c) => ({
    person: c.name.length > 10 ? c.name.slice(0, 10) + "…" : c.name,
    fullName: c.name,
    strength: c.strength,
    messages: c.messageCount,
  }));

  // Build traits radar: axes = trait dimensions, one series per person
  const TRAIT_KEYWORDS: Record<string, string[]> = {
    Formality: ["formal", "polite", "professional", "respectful", "courteous", "proper"],
    Humor: ["humor", "funny", "witty", "jokes", "sarcastic", "playful", "lighthearted"],
    Warmth: ["warm", "caring", "supportive", "empathetic", "kind", "loving", "affectionate"],
    Directness: ["direct", "blunt", "assertive", "straightforward", "honest", "frank"],
    Energy: ["enthusiastic", "energetic", "excited", "passionate", "lively", "animated"],
  };

  const traitDimensions = Object.keys(TRAIT_KEYWORDS);

  const scorePerson = (conn: ConnectionData) => {
    const allText = [...conn.userTraits, conn.userTone, conn.description].join(" ").toLowerCase();
    const scores: Record<string, number> = {};
    for (const [dim, keywords] of Object.entries(TRAIT_KEYWORDS)) {
      const hits = keywords.filter((kw) => allText.includes(kw)).length;
      // Score 0-10 scale: each keyword match = ~3 points, capped at 10
      scores[dim] = Math.min(10, Math.round((hits / keywords.length) * 10));
      // Boost if no data at all so chart isn't empty — give minimum 1 if there's any text
      if (scores[dim] === 0 && allText.length > 0) scores[dim] = 1;
    }
    // Emoji usage score based on count
    return scores;
  };

  const traitsRadarData = traitDimensions.map((dim) => {
    const entry: Record<string, any> = { trait: dim };
    connections.forEach((conn) => {
      entry[conn.name] = scorePerson(conn)[dim];
    });
    return entry;
  });

  // Add emoji usage as a dimension
  const maxEmojis = Math.max(1, ...connections.map((c) => c.userEmojis.length));
  traitsRadarData.push({
    trait: "Emoji Use",
    ...Object.fromEntries(
      connections.map((c) => [c.name, Math.round((c.userEmojis.length / maxEmojis) * 10)])
    ),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link to="/matrix" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">My Relationships</h1>
            <p className="text-xs text-muted-foreground">
              {userName ? `How ${userName} communicates` : "Your communication web"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No matches found</h3>
              <p className="mb-2 max-w-sm text-center text-muted-foreground">
                We couldn't match your profile name to any chat participants. Make sure your display name matches how you appear in your WhatsApp chats.
              </p>
              <p className="text-sm text-muted-foreground">
                Current name: <span className="font-medium text-foreground">{userName || "Not set"}</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Spider chart */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Relationship Web</CardTitle>
                  <CardDescription>Connection strength with each person (out of 10)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={380}>
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="person"
                        tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                      />
                      <Radar
                        name="Strength"
                        dataKey="strength"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                              <p className="text-sm font-medium">{d.fullName}</p>
                              <p className="text-xs text-muted-foreground">Strength: {d.strength}/10</p>
                              {d.messages > 0 && (
                                <p className="text-xs text-muted-foreground">{d.messages} messages</p>
                              )}
                            </div>
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Traits radar chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Communication Style</CardTitle>
                  <CardDescription>How your traits compare across people</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={380}>
                    <RadarChart data={traitsRadarData} outerRadius="75%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="trait"
                        tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                      />
                      {connections.map((conn, i) => (
                        <Radar
                          key={conn.name}
                          name={conn.name}
                          dataKey={conn.name}
                          stroke={COLORS[i % COLORS.length]}
                          fill={COLORS[i % COLORS.length]}
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      ))}
                      <Tooltip
                        content={({ label, payload }) => {
                          if (!payload?.length) return null;
                          return (
                            <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                              <p className="text-sm font-medium mb-1">{label}</p>
                              {payload.map((p: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
                                  <span className="text-muted-foreground">{p.name}:</span>
                                  <span className="font-medium">{p.value}/10</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {connections.map((conn, i) => (
                      <div key={conn.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {conn.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Person list & detail */}
            <div className="space-y-3 lg:col-span-2">
              {connections.map((conn, i) => (
                <Card
                  key={conn.name}
                  className={`cursor-pointer transition-all ${
                    selected?.name === conn.name
                      ? "ring-2 ring-primary shadow-md"
                      : "hover:shadow-sm"
                  }`}
                  onClick={() => setSelected(conn)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="font-semibold text-sm">{conn.name}</span>
                      </div>
                      <Badge variant="outline">{conn.type}</Badge>
                    </div>

                    {/* Strength bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(conn.strength / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{conn.strength}/10</span>
                    </div>

                    {selected?.name === conn.name && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {conn.userTone && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Your tone</p>
                            <Badge variant="outline" className="border-primary/30 text-primary">{conn.userTone}</Badge>
                          </div>
                        )}
                        {conn.userTraits.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Your traits</p>
                            <div className="flex flex-wrap gap-1">
                              {conn.userTraits.slice(0, 5).map((t, j) => (
                                <Badge key={j} variant="secondary" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {conn.userEmojis.length > 0 && (
                          <p className="text-sm">{conn.userEmojis.slice(0, 5).join(" ")}</p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-3">{conn.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyRelationships;
