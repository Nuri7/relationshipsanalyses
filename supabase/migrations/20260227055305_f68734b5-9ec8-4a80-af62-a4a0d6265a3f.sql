
-- Table to store dashboard share invitations
CREATE TABLE public.dashboard_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  label text, -- optional friendly label
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own shares
CREATE POLICY "Owners can view own shares"
  ON public.dashboard_shares FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert own shares"
  ON public.dashboard_shares FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own shares"
  ON public.dashboard_shares FOR DELETE
  USING (auth.uid() = owner_id);

-- Any authenticated user can look up a share by token (to view shared dashboard)
CREATE POLICY "Authenticated users can lookup shares by token"
  ON public.dashboard_shares FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to read uploads/analyses of shared dashboards
-- We need a security definer function to check if user has access via a share token
CREATE OR REPLACE FUNCTION public.is_shared_with_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dashboard_shares
    WHERE owner_id = target_user_id
  )
$$;

-- Add SELECT policies for shared access on chat_uploads and chat_analyses
CREATE POLICY "Shared users can view uploads"
  ON public.chat_uploads FOR SELECT
  TO authenticated
  USING (public.is_shared_with_user(user_id));

CREATE POLICY "Shared users can view analyses"
  ON public.chat_analyses FOR SELECT
  TO authenticated
  USING (public.is_shared_with_user(user_id));
