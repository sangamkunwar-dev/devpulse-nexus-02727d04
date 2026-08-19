
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid,
  subject text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view audit log" ON public.admin_audit_log
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);

-- private config (service_role only, no grants to anon/authenticated)
CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_config TO service_role;

INSERT INTO public.app_config (key, value)
VALUES ('notify_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- generic notifier: posts to the app's public notify endpoint
CREATE OR REPLACE FUNCTION public.notify_admin_event(_kind text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _secret text;
BEGIN
  SELECT value INTO _secret FROM public.app_config WHERE key = 'notify_secret';
  IF _secret IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://devpulse-nexus.lovable.app/api/public/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _secret),
    body := jsonb_build_object('kind', _kind, 'payload', _payload)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_admin_event(text, jsonb) FROM anon, authenticated, PUBLIC;

-- audit + notify on published challenge
CREATE OR REPLACE FUNCTION public.audit_challenge_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_log (event_type, actor_id, subject, details)
  VALUES ('challenge.published', auth.uid(), NEW.title,
          jsonb_build_object('challenge_id', NEW.id, 'date', NEW.challenge_date,
                             'language', NEW.language, 'difficulty', NEW.difficulty, 'xp', NEW.xp_reward));
  PERFORM public.notify_admin_event('challenge_published',
    jsonb_build_object('title', NEW.title, 'date', NEW.challenge_date, 'language', NEW.language,
                       'difficulty', NEW.difficulty, 'xp', NEW.xp_reward, 'prompt', NEW.prompt));
  RETURN NEW;
END; $$;

CREATE TRIGGER challenges_audit_publish
AFTER INSERT ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.audit_challenge_published();

-- audit template create/delete
CREATE OR REPLACE FUNCTION public.audit_template_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (event_type, actor_id, subject, details)
    VALUES ('template.created', auth.uid(), NEW.title,
            jsonb_build_object('template_id', NEW.id, 'language', NEW.language, 'difficulty', NEW.difficulty));
    RETURN NEW;
  ELSE
    INSERT INTO public.admin_audit_log (event_type, actor_id, subject, details)
    VALUES ('template.deleted', auth.uid(), OLD.title,
            jsonb_build_object('template_id', OLD.id, 'language', OLD.language, 'difficulty', OLD.difficulty));
    RETURN OLD;
  END IF;
END; $$;

CREATE TRIGGER challenge_templates_audit_ins
AFTER INSERT ON public.challenge_templates
FOR EACH ROW EXECUTE FUNCTION public.audit_template_change();

CREATE TRIGGER challenge_templates_audit_del
AFTER DELETE ON public.challenge_templates
FOR EACH ROW EXECUTE FUNCTION public.audit_template_change();

-- audit + notify on correct answer
CREATE OR REPLACE FUNCTION public.audit_correct_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uname text; _title text;
BEGIN
  IF NOT NEW.is_correct THEN RETURN NEW; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT title INTO _title FROM public.challenges WHERE id = NEW.challenge_id;
  INSERT INTO public.admin_audit_log (event_type, actor_id, subject, details)
  VALUES ('attempt.correct', NEW.user_id, _title,
          jsonb_build_object('challenge_id', NEW.challenge_id, 'username', _uname));
  PERFORM public.notify_admin_event('correct_answer',
    jsonb_build_object('username', COALESCE(_uname, 'someone'), 'title', COALESCE(_title, 'a challenge'),
                       'answer', left(NEW.answer, 300)));
  RETURN NEW;
END; $$;

CREATE TRIGGER challenge_attempts_audit_correct
AFTER INSERT ON public.challenge_attempts
FOR EACH ROW EXECUTE FUNCTION public.audit_correct_attempt();
