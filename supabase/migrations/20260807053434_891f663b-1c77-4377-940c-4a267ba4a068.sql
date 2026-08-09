CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.process_settlement_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  d public.duels%ROWTYPE;
  v_vote public.duel_vote;
  v_voter uuid;
  v_other uuid;
BEGIN
  PERFORM public.expire_stale_challenges();

  -- 1) Un seul vote depuis plus de 24 h : forfait du joueur silencieux
  FOR d IN
    SELECT * FROM public.duels
    WHERE status IN ('active','waiting_votes')
      AND ((player1_vote IS NULL) <> (player2_vote IS NULL))
      AND COALESCE(player1_voted_at, player2_voted_at) < now() - interval '24 hours'
  LOOP
    IF d.player1_vote IS NOT NULL THEN
      v_vote := d.player1_vote; v_voter := d.player1_id; v_other := d.player2_id;
    ELSE
      v_vote := d.player2_vote; v_voter := d.player2_id; v_other := d.player1_id;
    END IF;

    IF v_vote = 'draw' THEN
      PERFORM public._settle_duel(d.id, 'draw', NULL, 'Clôture automatique : match nul déclaré, adversaire silencieux 24 h.');
    ELSIF v_vote = 'win' THEN
      PERFORM public._settle_duel(d.id, 'winner', v_voter, 'Clôture automatique : forfait de l''adversaire (aucun vote sous 24 h).');
    ELSE
      PERFORM public._settle_duel(d.id, 'winner', v_other, 'Clôture automatique : défaite déclarée, adversaire silencieux 24 h.');
    END IF;

    PERFORM public._notify(v_voter, 'duel_auto_closed', 'Duel clôturé automatiquement',
      'Ton adversaire n''a pas voté sous 24 h : le duel a été réglé selon ta déclaration.', '/duels/' || d.id);
    PERFORM public._notify(v_other, 'duel_auto_closed', 'Duel clôturé automatiquement',
      'Tu n''as pas voté sous 24 h : le duel a été réglé selon la déclaration de ton adversaire.', '/duels/' || d.id);
    PERFORM public._admin_log(NULL, 'duel_auto_closed', 'duel', d.id, 'Forfait automatique après 24 h sans vote', '{}'::jsonb);
  END LOOP;

  -- 2) Litiges non arbitrés après la date limite : annulation et remboursement intégral
  FOR d IN
    SELECT * FROM public.duels
    WHERE status = 'dispute'
      AND manual_review_due_at IS NOT NULL
      AND manual_review_due_at < now()
  LOOP
    PERFORM public._settle_duel(d.id, 'cancel', NULL, 'Clôture automatique : litige non arbitré dans le délai, mises remboursées.');
    PERFORM public._notify(d.player1_id, 'dispute_auto_closed', 'Litige clôturé automatiquement',
      'Aucun arbitrage dans le délai : le duel est annulé et ta mise est remboursée intégralement.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'dispute_auto_closed', 'Litige clôturé automatiquement',
      'Aucun arbitrage dans le délai : le duel est annulé et ta mise est remboursée intégralement.', '/duels/' || d.id);
    PERFORM public._admin_log(NULL, 'dispute_auto_closed', 'duel', d.id, 'Litige clôturé automatiquement (délai dépassé)', '{}'::jsonb);
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.process_settlement_queue() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('s2c-settlement-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 's2c-settlement-queue');

SELECT cron.schedule('s2c-settlement-queue', '*/10 * * * *', $$SELECT public.process_settlement_queue();$$);