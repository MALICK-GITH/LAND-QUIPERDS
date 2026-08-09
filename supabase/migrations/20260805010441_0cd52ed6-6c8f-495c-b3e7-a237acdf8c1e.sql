CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username text;
  v_efoot text;
BEGIN
  v_username := COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), split_part(NEW.email,'@',1));
  v_efoot := COALESCE(NULLIF(NEW.raw_user_meta_data->>'efootball_username',''), v_username);

  INSERT INTO public.profiles (id, username, efootball_username, first_name, last_name, country, level)
  VALUES (
    NEW.id, v_username, v_efoot,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country',''), 'Cote d''Ivoire'),
    COALESCE((NEW.raw_user_meta_data->>'level')::public.user_level, 'Amateur')
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');

  IF lower(NEW.email) = 'onexdelux@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET level = 'Elite', badge = 'FONDATEUR' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;