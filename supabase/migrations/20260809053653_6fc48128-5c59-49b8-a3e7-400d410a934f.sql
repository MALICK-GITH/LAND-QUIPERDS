ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_key ON public.profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at timestamptz
);
GRANT SELECT ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tlc_select_own" ON public.telegram_link_codes;
CREATE POLICY "tlc_select_own" ON public.telegram_link_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings(key, value) VALUES
  ('telegram_notify_secret', 'a09db0e787dfeb5376ad89daa5da7dddc33b81d5968dacc2'),
  ('app_base_url', 'https://moon-quiperd.vercel.app')
ON CONFLICT (key) DO NOTHING;

-- Génère un code de liaison à usage unique pour le joueur connecté
CREATE OR REPLACE FUNCTION public.create_telegram_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.telegram_link_codes WHERE user_id = auth.uid() AND used_at IS NULL;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.telegram_link_codes(code, user_id) VALUES (v_code, auth.uid());
  RETURN v_code;
END; $$;
REVOKE ALL ON FUNCTION public.create_telegram_link_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_telegram_link_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlink_telegram()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles
     SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL
   WHERE id = auth.uid();
  DELETE FROM public.telegram_link_codes WHERE user_id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.unlink_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_telegram() TO authenticated;

-- Relais des notifications vers le robot Telegram
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.forward_notification_to_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_chat bigint;
  v_secret text;
  v_base text;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT telegram_chat_id INTO v_chat FROM public.profiles WHERE id = NEW.user_id;
  IF v_chat IS NULL THEN RETURN NEW; END IF;
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'telegram_notify_secret';
  SELECT value INTO v_base FROM public.app_settings WHERE key = 'app_base_url';
  IF v_secret IS NULL OR v_base IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := v_base || '/api/public/telegram/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.forward_notification_to_telegram() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifications_telegram ON public.notifications;
CREATE TRIGGER trg_notifications_telegram
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.forward_notification_to_telegram();
