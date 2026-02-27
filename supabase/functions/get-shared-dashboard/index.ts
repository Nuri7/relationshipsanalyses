import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify JWT
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Look up share token using service role (bypasses RLS)
  const { data: share, error: shareErr } = await supabase
    .from("dashboard_shares")
    .select("owner_id")
    .eq("token", token)
    .single();

  if (shareErr || !share) {
    return new Response(JSON.stringify({ error: "Invalid or revoked share link" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ownerId = share.owner_id;

  // Fetch owner profile, uploads, and analyses using service role
  const [profileRes, uploadsRes, analysesRes] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", ownerId).single(),
    supabase.from("chat_uploads").select("*").eq("user_id", ownerId).order("created_at", { ascending: false }),
    supabase.from("chat_analyses").select("upload_id, relationships").eq("user_id", ownerId),
  ]);

  return new Response(JSON.stringify({
    ownerName: profileRes.data?.display_name || "Someone",
    uploads: uploadsRes.data || [],
    analyses: analysesRes.data || [],
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
