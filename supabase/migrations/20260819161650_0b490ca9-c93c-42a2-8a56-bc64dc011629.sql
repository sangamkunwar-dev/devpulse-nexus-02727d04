
REVOKE EXECUTE ON FUNCTION public.audit_challenge_published() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_template_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_correct_attempt() FROM anon, authenticated, PUBLIC;
