import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquareText, Users, Smile, TrendingUp } from "lucide-react";

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

interface PersonProfile {
  name: string;
  totalMessages: number;
  traits: string[];
  tones: string[];
  topEmojis: string[];
  relationshipTypes: string[];
  avgStrength: number;
  descriptions: string[];
  chatSources: string[];
}

const CommunicationMatrix = () => {
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    const { data: analyses } = await supabase
      .from("chat_analyses")
      .select("*, chat_uploads!chat_analyses_upload_id_fkey(filename)");

    if (!analyses || analyses.length === 0) {
      setLoading(false);
      return;
    }

    const profileMap = new Map<string, PersonProfile>();

    for (const analysis of analyses) {
      const chars: Characteristic[] = Array.isArray(analysis.characteristics) ? analysis.characteristics as any[] : [];
      const rels: Relationship[] = Array.isArray(analysis.relationships) ? analysis.relationships as any[] : [];
      const filename = (analysis as any).chat_uploads?.filename || "Unknown";

      for (const char of chars) {
        const existing = profileMap.get(char.name) || {
          name: char.name,
          totalMessages: 0,
          traits: [],
          tones: [],
          topEmojis: [],
          relationshipTypes: [],
          avgStrength: 0,
          descriptions: [],
          chatSources: [],
        };

        existing.totalMessages += char.messageCount || 0;
        existing.traits.push(...char.traits);
        if (char.dominantTone) existing.tones.push(char.dominantTone);
        if (char.topEmojis) existing.topEmojis.push(...char.topEmojis);
        existing.descriptions.push(char.description);
        if (!existing.chatSources.includes(filename)) existing.chatSources.push(filename);

        profileMap.set(char.name, existing);
      }

      for (const rel of rels) {
        for (const person of [rel.person1, rel.person2]) {
          const existing = profileMap.get(person);
          if (existing) {
            if (!existing.relationshipTypes.includes(rel.type)) {
              existing.relationshipTypes.push(rel.type);
            }
            existing.avgStrength = existing.avgStrength
              ? (existing.avgStrength + rel.strength) / 2
              : rel.strength;
          }
        }
      }
    }

    // Dedupe traits and emojis
    for (const [, profile] of profileMap) {
      profile.traits = [...new Set(profile.traits)];
      profile.topEmojis = [...new Set(profile.topEmojis)].slice(0, 5);
      profile.tones = [...new Set(profile.tones)];
    }

    const sorted = [...profileMap.values()].sort((a, b) => b.totalMessages - a.totalMessages);
    setProfiles(sorted);
    setLoading(false);
  };

  const strengthColor = (strength: number) => {
    if (strength >= 7) return "bg-accent text-accent-foreground";
    if (strength >= 4) return "bg-primary/20 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Communication Matrix</h1>
            <p className="text-xs text-muted-foreground">Your style across all conversations</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No data yet</h3>
              <p className="mb-6 text-center text-muted-foreground">
                Upload and analyze chats to see your communication matrix
              </p>
              <Link to="/upload">
                <Button>Upload a Chat</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((person) => (
              <Card key={person.name} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{person.name}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <MessageSquareText className="h-3 w-3" />
                        {person.totalMessages} messages
                        {person.chatSources.length > 1 && (
                          <span>• {person.chatSources.length} chats</span>
                        )}
                      </CardDescription>
                    </div>
                    {person.avgStrength > 0 && (
                      <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${strengthColor(person.avgStrength)}`}>
                        <TrendingUp className="h-3 w-3" />
                        {person.avgStrength.toFixed(1)}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Tones */}
                  {person.tones.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tone</p>
                      <div className="flex flex-wrap gap-1.5">
                        {person.tones.map((tone, i) => (
                          <Badge key={i} variant="outline" className="border-primary/30 text-primary">
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Traits */}
                  {person.traits.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Traits</p>
                      <div className="flex flex-wrap gap-1.5">
                        {person.traits.slice(0, 6).map((trait, i) => (
                          <Badge key={i} variant="secondary">{trait}</Badge>
                        ))}
                        {person.traits.length > 6 && (
                          <Badge variant="secondary">+{person.traits.length - 6}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emojis */}
                  {person.topEmojis.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-base tracking-wide">{person.topEmojis.join(" ")}</span>
                    </div>
                  )}

                  {/* Relationship types */}
                  {person.relationshipTypes.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {person.relationshipTypes.join(", ")}
                    </div>
                  )}

                  {/* Description preview */}
                  {person.descriptions.length > 0 && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {person.descriptions[0]}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CommunicationMatrix;
