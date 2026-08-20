CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_email_key ON public.notification_recipients (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage notification recipients" ON public.notification_recipients;
CREATE POLICY "admins manage notification recipients"
ON public.notification_recipients FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_recipient_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address: %', NEW.email;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notification_recipients_validate ON public.notification_recipients;
CREATE TRIGGER notification_recipients_validate
BEFORE INSERT OR UPDATE ON public.notification_recipients
FOR EACH ROW EXECUTE FUNCTION public.validate_recipient_email();

INSERT INTO public.notification_recipients (email)
VALUES ('sangamkunwar48@gmail.com')
ON CONFLICT DO NOTHING;

-- ensure the designated admin account has the admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'sangamkunwar48@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;