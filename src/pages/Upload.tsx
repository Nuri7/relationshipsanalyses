import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseWhatsAppChat, formatChatForAI } from "@/lib/chatParser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, FileText, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  const validateAndSetFile = (f: File) => {
    const validTypes = [".txt", ".zip"];
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast({ title: "Invalid file", description: "Please upload a .txt or .zip file", variant: "destructive" });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 20MB", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    setStatus("Reading file...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Read file content
      let chatText = "";
      if (file.name.endsWith(".txt")) {
        chatText = await file.text();
      } else {
        // For zip files, we'd need JSZip - for now handle .txt only
        toast({ title: "ZIP support", description: "ZIP files will be supported soon. Please upload the .txt file directly.", variant: "destructive" });
        setUploading(false);
        return;
      }

      setProgress(20);
      setStatus("Parsing chat...");

      const parsed = parseWhatsAppChat(chatText);
      if (parsed.messages.length === 0) {
        toast({ title: "No messages found", description: "Could not parse any messages. Make sure this is a valid WhatsApp chat export.", variant: "destructive" });
        setUploading(false);
        return;
      }

      // Generate a friendly filename from participant names
      const friendlyName = parsed.participants.length > 0
        ? parsed.participants.join(" & ") + ".txt"
        : file.name;

      setProgress(30);
      setStatus("Uploading file...");

      // Upload file to storage - sanitize filename for storage compatibility
      const sanitizedName = friendlyName.replace(/[^\w.\-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${sanitizedName}`;
      const { error: storageError } = await supabase.storage
        .from("chat-files")
        .upload(filePath, file);

      if (storageError) throw storageError;

      setProgress(50);
      setStatus("Saving metadata...");

      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from("chat_uploads")
        .insert({
          user_id: user.id,
          filename: friendlyName,
          file_path: filePath,
          status: "parsing",
          message_count: parsed.messages.length,
          participant_count: parsed.participants.length,
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      setProgress(60);
      setStatus("Analyzing with AI...");

      // Call AI analysis
      const chatForAI = formatChatForAI(parsed.messages);
      const { data: analysisResult, error: fnError } = await supabase.functions.invoke("analyze-chat", {
        body: {
          uploadId: upload.id,
          chatText: chatForAI,
          participants: parsed.participants,
        },
      });

      if (fnError) throw fnError;

      setProgress(100);
      setStatus("Complete!");

      toast({ title: "Analysis complete!", description: `Parsed ${parsed.messages.length} messages from ${parsed.participants.length} participants.` });

      setTimeout(() => navigate(`/analysis/${upload.id}`), 1000);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      setProgress(0);
      setStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Upload Chat Export</CardTitle>
            <CardDescription>
              Upload a WhatsApp chat export (.txt) to analyze conversations, personality traits, and relationships.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <UploadIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium">Drag & drop your chat export</p>
              <p className="mb-4 text-sm text-muted-foreground">or click to browse</p>
              <input
                type="file"
                accept=".txt,.zip"
                className="hidden"
                id="file-input"
                onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
              />
              <Button variant="outline" onClick={() => document.getElementById("file-input")?.click()}>
                Choose File
              </Button>
            </div>

            {/* Selected file */}
            {file && !uploading && (
              <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-3">
                <Progress value={progress} />
                <p className="text-center text-sm text-muted-foreground">{status}</p>
              </div>
            )}

            {/* Upload button */}
            {file && !uploading && (
              <Button className="w-full" size="lg" onClick={handleUpload}>
                Analyze Chat
              </Button>
            )}

            {/* Instructions */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="mb-2 font-medium">How to export WhatsApp chats:</h4>
              <ol className="space-y-1 text-sm text-muted-foreground">
                <li>1. Open a WhatsApp chat</li>
                <li>2. Tap ⋮ → More → Export chat</li>
                <li>3. Choose "Without Media" or "Include Media"</li>
                <li>4. Save the .txt file and upload it here</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Upload;
