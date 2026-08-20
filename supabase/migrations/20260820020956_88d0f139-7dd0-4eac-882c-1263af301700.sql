REVOKE ALL ON FUNCTION public.notify_admin_event(text, jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.publish_daily_challenge() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.validate_recipient_email() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.submit_challenge_answer(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_challenge_answer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "no client access to app_config" ON public.app_config;
CREATE POLICY "no client access to app_config" ON public.app_config FOR SELECT TO authenticated USING (false);