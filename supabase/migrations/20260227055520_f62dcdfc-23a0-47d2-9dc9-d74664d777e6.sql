
-- Allow authenticated users to read profiles of users who have shared their dashboard
CREATE OR REPLACE FUNCTION public.has_active_share(target_user_id uuid)
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

CREATE POLICY "Shared users can view owner profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_active_share(id));
