import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Network,
  MessageCircle,
  Users,
  BarChart3,
  Shield,
  Zap,
  ArrowLeft,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Chat Import",
    description:
      "Upload WhatsApp chat exports and let our engine parse every message, timestamp, and participant automatically.",
  },
  {
    icon: Network,
    title: "Relationship Mapping",
    description:
      "Visualise how participants connect with each other through an interactive relationship graph.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description:
      "Get detailed statistics on message frequency, response times, sentiment trends, and conversation balance.",
  },
  {
    icon: Users,
    title: "Participant Profiles",
    description:
      "Discover each person's communication style, activity patterns, and unique characteristics.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Your data stays yours. All analysis happens securely and chats are never shared with third parties.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    description:
      "AI-powered analysis delivers comprehensive insights within seconds of uploading your chat.",
  },
];

const Features = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="Logo" className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-lg font-bold">Relationship Analyzer</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Understand Your Conversations
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload a chat, uncover relationship dynamics, and gain insights you never noticed before.
        </p>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-start gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Features;
