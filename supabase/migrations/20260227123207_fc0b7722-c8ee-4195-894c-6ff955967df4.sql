
-- Drop the overly permissive shared-view policies
DROP POLICY IF EXISTS "Shared users can view uploads" ON public.chat_uploads;
DROP POLICY IF EXISTS "Shared users can view analyses" ON public.chat_analyses;
DROP POLICY IF EXISTS "Shared users can view owner profile" ON public.profiles;

-- Drop the helper functions no longer needed for RLS
DROP FUNCTION IF EXISTS public.is_shared_with_user(uuid);
DROP FUNCTION IF EXISTS public.has_active_share(uuid);
