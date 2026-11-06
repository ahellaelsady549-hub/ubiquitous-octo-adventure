-- 1) Restrict public read on user_restrictions
DROP POLICY IF EXISTS "restrictions readable" ON public.user_restrictions;

CREATE POLICY "restrictions read own or admin"
ON public.user_restrictions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.user_restrictions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_restrictions TO authenticated;
GRANT ALL ON public.user_restrictions TO service_role;

-- 2) Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_owner_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_restricted(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- has_role is invoked by the app for the signed-in user's own admin check
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;