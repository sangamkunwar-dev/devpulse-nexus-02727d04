-- Assign the designated admin role after the account exists.
-- This is idempotent and safe to run more than once.
-- Backfill the designated account when it already exists.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'sangamkunwar48@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Keep the role assignment working for a newly created account too. The old
-- one-time INSERT does nothing when the SQL is run before the account exists.
CREATE OR REPLACE FUNCTION public.assign_designated_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(trim(NEW.email)) = 'sangamkunwar48@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_designated_admin_on_signup ON auth.users;
CREATE TRIGGER assign_designated_admin_on_signup
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_designated_admin();
