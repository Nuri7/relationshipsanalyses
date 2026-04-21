import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { uploadId, chatText, participants } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to analyzing
    await supabase.from("chat_uploads").update({ status: "analyzing" }).eq("id", uploadId);

    // Truncate chat text if too long (keep first ~15000 chars for AI context)
    const truncatedText = chatText.length > 15000 ? chatText.slice(0, 15000) + "\n...[truncated]" : chatText;

const systemPrompt = `You are a chat conversation analyst. Analyze the following WhatsApp/chat export and return a JSON object with exactly this structure:
{
  "summary": "A concise summary (max 400 words) of key topics, events, and overall tone. MUST include two specific sections formatted with markdown headers: '### Timeline Progression' (describing how the dynamic evolved over Beginning, Middle, Current phases) and '### Hall of Fame' (listing 3 exact, iconic, or funny quotes from the text).",
  "characteristics": [
    {
      "name": "Person Name",
      "traits": ["trait1", "trait2", "trait3"],
      "description": "2-3 sentence description of this person's communication style",
      "archetype": "A fun 2-3 word title, e.g., 'The Novelist', 'The Ghost', 'Emoji Expert'",
      "messageCount": number,
      "topEmojis": ["emoji1", "emoji2"],
      "dominantTone": "e.g. humorous, analytical, supportive"
    }
  ],
  "relationships": [
    {
      "person1": "Name1",
      "person2": "Name2",
      "type": "friends|family|professional|romantic|acquaintances",
      "strength": 1-10,
      "description": "Brief description of the dynamic between them"
    }
  ]
}

Participants found: ${participants.join(", ")}

Analyze based on message frequency, language style, emoji usage, topics discussed, response patterns, and sentiment.
Return ONLY valid JSON, no markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: truncatedText },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      
      if (response.status === 429) {
        await supabase.from("chat_uploads").update({ status: "error", error_message: "Rate limited. Please try again later." }).eq("id", uploadId);
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        await supabase.from("chat_uploads").update({ status: "error", error_message: "AI credits exhausted." }).eq("id", uploadId);
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log("AI response status:", response.status);
    console.log("AI result keys:", Object.keys(aiResult));
    console.log("AI choices length:", aiResult.choices?.length);
    console.log("AI finish_reason:", aiResult.choices?.[0]?.finish_reason);
    
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("Full AI response:", JSON.stringify(aiResult).slice(0, 500));
      throw new Error("No content in AI response. Finish reason: " + (aiResult.choices?.[0]?.finish_reason || "unknown"));
    }

    // Parse the JSON from AI response (strip markdown code fences if present)
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const analysis = JSON.parse(cleanContent);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    }).auth.getUser();

    if (!user) throw new Error("Unauthorized");

    // Save analysis
    const { error: insertError } = await supabase.from("chat_analyses").upsert({
      upload_id: uploadId,
      user_id: user.id,
      summary: analysis.summary,
      characteristics: analysis.characteristics || [],
      relationships: analysis.relationships || [],
      participants: participants,
    }, { onConflict: "upload_id" });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save analysis");
    }

    // Update upload status
    await supabase.from("chat_uploads").update({ 
      status: "completed",
      participant_count: participants.length
    }).eq("id", uploadId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-chat error:", e);
    // Mark the upload as errored so it doesn't get stuck on "analyzing"
    try {
      const { uploadId: failedUploadId } = await req.clone().json().catch(() => ({ uploadId: undefined }));
      if (failedUploadId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("chat_uploads").update({
          status: "error",
          error_message: e instanceof Error ? e.message : "Unknown error"
        }).eq("id", failedUploadId);
      }
    } catch { /* ignore secondary errors */ }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

