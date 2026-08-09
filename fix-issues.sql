-- Script de réparation pour les problèmes OAuth et création de profil
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. S'assurer que la fonction handle_new_user existe
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

  IF lower(NEW.email) IN ('onexdelux@gmail.com','jeaneric9610@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET level = 'Elite', badge = 'FONDATEUR' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $$;

-- 2. Créer le trigger s'il n'existe pas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Réparer les utilisateurs existants sans profil
DO $$
DECLARE
  user_record RECORD;
  v_username text;
  v_efoot text;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    v_username := COALESCE(NULLIF(user_record.raw_user_meta_data->>'username',''), split_part(user_record.email,'@',1));
    v_efoot := COALESCE(NULLIF(user_record.raw_user_meta_data->>'efootball_username',''), v_username);

    INSERT INTO public.profiles (id, username, efootball_username, first_name, last_name, country, level)
    VALUES (
      user_record.id, v_username, v_efoot,
      user_record.raw_user_meta_data->>'first_name',
      user_record.raw_user_meta_data->>'last_name',
      COALESCE(NULLIF(user_record.raw_user_meta_data->>'country',''), 'Cote d''Ivoire'),
      COALESCE((user_record.raw_user_meta_data->>'level')::public.user_level, 'Amateur')
    );

    INSERT INTO public.wallets (user_id) VALUES (user_record.id);
    INSERT INTO public.user_roles (user_id, role) VALUES (user_record.id, 'player');

    IF lower(user_record.email) IN ('onexdelux@gmail.com','jeaneric9610@gmail.com') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (user_record.id, 'admin')
      ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET level = 'Elite', badge = 'FONDATEUR' WHERE id = user_record.id;
    END IF;
    
    RAISE NOTICE 'Profil créé pour l''utilisateur: %', user_record.email;
  END LOOP;
END $$;

-- 4. Réparer les utilisateurs sans wallet
INSERT INTO public.wallets (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE w.id IS NULL;

-- 5. S'assurer que les admins ont le rôle admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) IN ('onexdelux@gmail.com','jeaneric9610@gmail.com')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'admin'
);

-- 6. Mettre à jour les profils admin
UPDATE public.profiles p
SET level = 'Elite', badge = 'FONDATEUR'
WHERE EXISTS (
  SELECT 1 FROM auth.users u 
  WHERE u.id = p.id 
  AND lower(u.email) IN ('onexdelux@gmail.com','jeaneric9610@gmail.com')
);

-- 6b. Créer manuellement le profil admin pour onexdelux@gmail.com s'il n'existe pas
DO $$
DECLARE
  v_user_id uuid;
  v_username text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'onexdelux@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Vérifier si le profil existe
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
      v_username := split_part('onexdelux@gmail.com', '@', 1);
      
      INSERT INTO public.profiles (id, username, efootball_username, first_name, last_name, country, level)
      VALUES (v_user_id, v_username, v_username, NULL, NULL, 'Cote d''Ivoire', 'Elite');
      
      INSERT INTO public.wallets (user_id) VALUES (v_user_id);
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'player');
      
      RAISE NOTICE 'Profil créé pour onexdelux@gmail.com';
    END IF;
    
    -- S'assurer que le rôle admin est attribué
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
      UPDATE public.profiles SET badge = 'FONDATEUR' WHERE id = v_user_id;
      RAISE NOTICE 'Rôle admin attribué à onexdelux@gmail.com';
    END IF;
  ELSE
    RAISE NOTICE 'Utilisateur onexdelux@gmail.com non trouvé dans auth.users';
  END IF;
END $$;

-- 7. Vérification finale
SELECT 
    'Réparation terminée' as status,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM public.wallets) as wallets_count,
    (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') as admins_count;
