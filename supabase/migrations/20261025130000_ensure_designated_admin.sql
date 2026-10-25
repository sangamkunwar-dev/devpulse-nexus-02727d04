-- Assign the designated admin role after the account exists.
-- This is idempotent and safe to run more than once.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'sangamkunwar48@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
