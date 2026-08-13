-- =============== HELPERS ===============
CREATE OR REPLACE FUNCTION public.get_commission_rate(p_amount numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT rate FROM public.commission_settings
    WHERE active AND type <> 'tournament'
      AND p_amount >= min_amount
      AND (max_amount IS NULL OR p_amount <= max_amount)
    ORDER BY min_amount DESC LIMIT 1
  ), 0.08);
$$;

CREATE OR REPLACE FUNCTION public._record_tx(
  p_user uuid, p_type public.tx_type, p_amount numeric,
  p_before numeric, p_after numeric, p_desc text,
  p_duel uuid DEFAULT NULL, p_deposit uuid DEFAULT NULL, p_withdrawal uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.transactions (user_id, wallet_id, type, amount, balance_before, balance_after, description, related_duel, related_deposit, related_withdrawal)
  SELECT p_user, w.id, p_type, p_amount, p_before, p_after, p_desc, p_duel, p_deposit, p_withdrawal
  FROM public.wallets w WHERE w.user_id = p_user;
END; $$;

CREATE OR REPLACE FUNCTION public._notify(p_user uuid, p_type text, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (p_user, p_type, p_title, p_body, p_link);
END; $$;

CREATE OR REPLACE FUNCTION public._notify_admins(p_type text, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, is_admin_notice, type, title, body, link)
  VALUES (NULL, true, p_type, p_title, p_body, p_link);
END; $$;

CREATE OR REPLACE FUNCTION public._admin_log(p_action text, p_target_type text, p_target uuid, p_note text, p_meta jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, note, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target, p_note, p_meta);
END; $$;

CREATE OR REPLACE FUNCTION public._require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs';
  END IF;
END; $$;

-- =============== DEFIS ===============
CREATE OR REPLACE FUNCTION public.create_challenge(p_challenged uuid, p_amount numeric, p_minutes integer DEFAULT 30)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_bal numeric; v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_challenged = v_me THEN RAISE EXCEPTION 'Vous ne pouvez pas vous défier vous-même'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_me AND (is_banned OR status <> 'active')) THEN
    RAISE EXCEPTION 'Votre compte ne peut pas lancer de défi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_challenged AND NOT is_banned AND status = 'active') THEN
    RAISE EXCEPTION 'Adversaire indisponible';
  END IF;
  SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = v_me;
  IF v_bal < p_amount THEN RAISE EXCEPTION 'Solde insuffisant pour cet enjeu'; END IF;

  INSERT INTO public.challenges (challenger_id, challenged_id, amount, expires_at)
  VALUES (v_me, p_challenged, p_amount, now() + make_interval(mins => GREATEST(p_minutes, 5)))
  RETURNING id INTO v_id;

  PERFORM public._notify(p_challenged, 'challenge_received', 'Nouveau défi reçu',
    'Vous avez reçu un défi de ' || p_amount || ' FCFA.', '/defis');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_challenge(p_challenge uuid, p_action text, p_counter_amount numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.challenges%ROWTYPE;
  v_me uuid := auth.uid();
  v_amount numeric; v_rate numeric; v_duel uuid;
  v_b1 numeric; v_b2 numeric; v_responder uuid;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v_me NOT IN (c.challenger_id, c.challenged_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF c.status NOT IN ('pending','counter_offer') THEN RAISE EXCEPTION 'Ce défi n''est plus actif'; END IF;
  IF c.expires_at < now() THEN
    UPDATE public.challenges SET status = 'expired' WHERE id = c.id;
    RAISE EXCEPTION 'Ce défi a expiré';
  END IF;

  v_responder := CASE WHEN c.status = 'pending' THEN c.challenged_id ELSE c.challenger_id END;

  IF p_action = 'cancel' THEN
    IF v_me <> c.challenger_id THEN RAISE EXCEPTION 'Seul l''auteur peut annuler'; END IF;
    UPDATE public.challenges SET status = 'cancelled' WHERE id = c.id;
    RETURN NULL;
  END IF;

  IF v_me <> v_responder THEN RAISE EXCEPTION 'Ce n''est pas à vous de répondre'; END IF;

  IF p_action = 'decline' THEN
    UPDATE public.challenges SET status = 'declined' WHERE id = c.id;
    PERFORM public._notify(CASE WHEN v_me = c.challenger_id THEN c.challenged_id ELSE c.challenger_id END,
      'challenge_declined', 'Défi refusé', 'Votre défi a été refusé.', '/defis');
    RETURN NULL;
  END IF;

  IF p_action = 'counter' THEN
    IF p_counter_amount IS NULL OR p_counter_amount <= 0 THEN RAISE EXCEPTION 'Montant de contre-offre invalide'; END IF;
    UPDATE public.challenges SET status = 'counter_offer', accepted_amount = p_counter_amount WHERE id = c.id;
    PERFORM public._notify(c.challenger_id, 'challenge_counter', 'Contre-offre reçue',
      'Nouvelle proposition : ' || p_counter_amount || ' FCFA.', '/defis');
    RETURN NULL;
  END IF;

  IF p_action <> 'accept' THEN RAISE EXCEPTION 'Action inconnue'; END IF;

  v_amount := COALESCE(c.accepted_amount, c.amount);

  SELECT balance_available INTO v_b1 FROM public.wallets WHERE user_id = c.challenger_id FOR UPDATE;
  SELECT balance_available INTO v_b2 FROM public.wallets WHERE user_id = c.challenged_id FOR UPDATE;
  IF v_b1 < v_amount THEN RAISE EXCEPTION 'Solde insuffisant côté challenger'; END IF;
  IF v_b2 < v_amount THEN RAISE EXCEPTION 'Solde insuffisant côté adversaire'; END IF;

  v_rate := public.get_commission_rate(v_amount);

  INSERT INTO public.duels (player1_id, player2_id, amount, commission_rate, commission_amount, challenge_id, status)
  VALUES (c.challenger_id, c.challenged_id, v_amount, v_rate, ROUND(2 * v_amount * v_rate, 2), c.id, 'active')
  RETURNING id INTO v_duel;

  UPDATE public.wallets SET balance_available = balance_available - v_amount, balance_locked = balance_locked + v_amount
    WHERE user_id = c.challenger_id;
  UPDATE public.wallets SET balance_available = balance_available - v_amount, balance_locked = balance_locked + v_amount
    WHERE user_id = c.challenged_id;

  PERFORM public._record_tx(c.challenger_id, 'stake_locked', v_amount, v_b1, v_b1 - v_amount, 'Mise bloquée pour le duel', v_duel);
  PERFORM public._record_tx(c.challenged_id, 'stake_locked', v_amount, v_b2, v_b2 - v_amount, 'Mise bloquée pour le duel', v_duel);

  UPDATE public.challenges SET status = 'accepted', duel_id = v_duel, accepted_amount = v_amount WHERE id = c.id;

  PERFORM public._notify(c.challenger_id, 'duel_started', 'Duel lancé', 'Votre duel de ' || v_amount || ' FCFA a démarré.', '/duels/' || v_duel);
  PERFORM public._notify(c.challenged_id, 'duel_started', 'Duel lancé', 'Votre duel de ' || v_amount || ' FCFA a démarré.', '/duels/' || v_duel);
  RETURN v_duel;
END; $$;

-- =============== REGLEMENT DES DUELS ===============
CREATE OR REPLACE FUNCTION public._settle_duel(p_duel uuid, p_outcome text, p_winner uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.duels%ROWTYPE;
  v_pot numeric; v_com numeric; v_loser uuid;
  v_bw numeric; v_bl numeric; v_b1 numeric; v_b2 numeric; v_refund numeric; v_payout numeric;
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = p_duel FOR UPDATE;
  IF d.status IN ('finished','cancelled') THEN RAISE EXCEPTION 'Duel déjà réglé'; END IF;

  v_pot := 2 * d.amount;
  v_com := ROUND(v_pot * d.commission_rate, 2);

  IF p_outcome = 'winner' THEN
    IF p_winner IS NULL OR p_winner NOT IN (d.player1_id, d.player2_id) THEN RAISE EXCEPTION 'Gagnant invalide'; END IF;
    v_loser := CASE WHEN p_winner = d.player1_id THEN d.player2_id ELSE d.player1_id END;
    v_payout := v_pot - v_com;

    SELECT balance_available INTO v_bw FROM public.wallets WHERE user_id = p_winner FOR UPDATE;
    SELECT balance_available INTO v_bl FROM public.wallets WHERE user_id = v_loser FOR UPDATE;

    UPDATE public.wallets SET balance_locked = balance_locked - d.amount,
      balance_available = balance_available + v_payout,
      total_won = total_won + (v_payout - d.amount)
      WHERE user_id = p_winner;
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount,
      total_lost = total_lost + d.amount WHERE user_id = v_loser;

    PERFORM public._record_tx(p_winner, 'win', v_payout, v_bw, v_bw + v_payout, 'Gain du duel (pot ' || v_pot || ' - commission ' || v_com || ')', d.id);
    PERFORM public._record_tx(p_winner, 'commission', v_com, NULL, NULL, 'Commission plateforme', d.id);
    PERFORM public._record_tx(v_loser, 'loss', d.amount, v_bl, v_bl, 'Mise perdue', d.id);

    UPDATE public.profiles SET wins = wins + 1, current_streak = current_streak + 1,
      total_earnings = total_earnings + (v_payout - d.amount) WHERE id = p_winner;
    UPDATE public.profiles SET losses = losses + 1, current_streak = 0 WHERE id = v_loser;

    UPDATE public.duels SET status = 'finished', winner_id = p_winner, loser_id = v_loser,
      is_draw = false, commission_amount = v_com, finished_at = now(), admin_note = COALESCE(p_note, admin_note)
      WHERE id = d.id;

    PERFORM public._notify(p_winner, 'duel_won', 'Duel gagné', 'Vous avez remporté ' || v_payout || ' FCFA.', '/duels/' || d.id);
    PERFORM public._notify(v_loser, 'duel_lost', 'Duel perdu', 'Vous avez perdu votre mise de ' || d.amount || ' FCFA.', '/duels/' || d.id);

  ELSIF p_outcome = 'draw' THEN
    v_refund := d.amount - ROUND(v_com / 2, 2);
    SELECT balance_available INTO v_b1 FROM public.wallets WHERE user_id = d.player1_id FOR UPDATE;
    SELECT balance_available INTO v_b2 FROM public.wallets WHERE user_id = d.player2_id FOR UPDATE;

    UPDATE public.wallets SET balance_locked = balance_locked - d.amount,
      balance_available = balance_available + v_refund WHERE user_id IN (d.player1_id, d.player2_id);

    PERFORM public._record_tx(d.player1_id, 'stake_refunded', v_refund, v_b1, v_b1 + v_refund, 'Match nul : remboursement partiel', d.id);
    PERFORM public._record_tx(d.player2_id, 'stake_refunded', v_refund, v_b2, v_b2 + v_refund, 'Match nul : remboursement partiel', d.id);
    PERFORM public._record_tx(d.player1_id, 'commission', ROUND(v_com / 2, 2), NULL, NULL, 'Commission plateforme (nul)', d.id);
    PERFORM public._record_tx(d.player2_id, 'commission', ROUND(v_com / 2, 2), NULL, NULL, 'Commission plateforme (nul)', d.id);

    UPDATE public.profiles SET draws = draws + 1, current_streak = 0 WHERE id IN (d.player1_id, d.player2_id);
    UPDATE public.duels SET status = 'finished', is_draw = true, commission_amount = v_com,
      finished_at = now(), admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;

    PERFORM public._notify(d.player1_id, 'duel_draw', 'Match nul', 'Remboursement de ' || v_refund || ' FCFA.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_draw', 'Match nul', 'Remboursement de ' || v_refund || ' FCFA.', '/duels/' || d.id);

  ELSIF p_outcome = 'cancel' THEN
    SELECT balance_available INTO v_b1 FROM public.wallets WHERE user_id = d.player1_id FOR UPDATE;
    SELECT balance_available INTO v_b2 FROM public.wallets WHERE user_id = d.player2_id FOR UPDATE;
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount,
      balance_available = balance_available + d.amount WHERE user_id IN (d.player1_id, d.player2_id);
    PERFORM public._record_tx(d.player1_id, 'stake_refunded', d.amount, v_b1, v_b1 + d.amount, 'Duel annulé : remboursement intégral', d.id);
    PERFORM public._record_tx(d.player2_id, 'stake_refunded', d.amount, v_b2, v_b2 + d.amount, 'Duel annulé : remboursement intégral', d.id);
    UPDATE public.duels SET status = 'cancelled', commission_amount = 0, finished_at = now(),
      admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
    PERFORM public._notify(d.player1_id, 'duel_cancelled', 'Duel annulé', 'Votre mise a été remboursée.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_cancelled', 'Duel annulé', 'Votre mise a été remboursée.', '/duels/' || d.id);

  ELSIF p_outcome = 'cancel_no_refund' THEN
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount,
      total_lost = total_lost + d.amount WHERE user_id IN (d.player1_id, d.player2_id);
    PERFORM public._record_tx(d.player1_id, 'loss', d.amount, NULL, NULL, 'Duel annulé sans remboursement (sanction)', d.id);
    PERFORM public._record_tx(d.player2_id, 'loss', d.amount, NULL, NULL, 'Duel annulé sans remboursement (sanction)', d.id);
    UPDATE public.duels SET status = 'cancelled', commission_amount = v_pot, finished_at = now(),
      admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
    PERFORM public._notify(d.player1_id, 'duel_cancelled', 'Duel annulé', 'Annulation sans remboursement.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_cancelled', 'Duel annulé', 'Annulation sans remboursement.', '/duels/' || d.id);
  ELSE
    RAISE EXCEPTION 'Résolution inconnue';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_duel_vote(p_duel uuid, p_vote public.duel_vote)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.duels%ROWTYPE; v_me uuid := auth.uid(); v1 public.duel_vote; v2 public.duel_vote;
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  IF v_me NOT IN (d.player1_id, d.player2_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF d.status NOT IN ('active','waiting_votes') THEN RAISE EXCEPTION 'Ce duel n''accepte plus de vote'; END IF;

  IF v_me = d.player1_id THEN
    IF d.player1_vote IS NOT NULL THEN RAISE EXCEPTION 'Vous avez déjà voté'; END IF;
    UPDATE public.duels SET player1_vote = p_vote, player1_voted_at = now(), status = 'waiting_votes' WHERE id = d.id;
  ELSE
    IF d.player2_vote IS NOT NULL THEN RAISE EXCEPTION 'Vous avez déjà voté'; END IF;
    UPDATE public.duels SET player2_vote = p_vote, player2_voted_at = now(), status = 'waiting_votes' WHERE id = d.id;
  END IF;

  SELECT player1_vote, player2_vote INTO v1, v2 FROM public.duels WHERE id = d.id;
  IF v1 IS NULL OR v2 IS NULL THEN RETURN 'waiting'; END IF;

  IF v1 = 'win' AND v2 = 'lose' THEN
    PERFORM public._settle_duel(d.id, 'winner', d.player1_id); RETURN 'player1';
  ELSIF v1 = 'lose' AND v2 = 'win' THEN
    PERFORM public._settle_duel(d.id, 'winner', d.player2_id); RETURN 'player2';
  ELSIF v1 = 'draw' AND v2 = 'draw' THEN
    PERFORM public._settle_duel(d.id, 'draw'); RETURN 'draw';
  ELSE
    UPDATE public.duels SET status = 'dispute',
      dispute_reason = 'Votes incohérents : joueur 1 = ' || v1 || ', joueur 2 = ' || v2,
      manual_review_requested_at = now(), manual_review_due_at = now() + interval '24 hours'
      WHERE id = d.id;
    PERFORM public._notify(d.player1_id, 'duel_dispute', 'Litige ouvert', 'Les votes ne concordent pas. Un administrateur va trancher.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_dispute', 'Litige ouvert', 'Les votes ne concordent pas. Un administrateur va trancher.', '/duels/' || d.id);
    PERFORM public._notify_admins('dispute_pending', 'Litige à arbitrer', 'Un duel de ' || d.amount || ' FCFA est en litige.', '/admin');
    RETURN 'dispute';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.open_duel_dispute(p_duel uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.duels%ROWTYPE; v_me uuid := auth.uid();
BEGIN
  SELECT * INTO d FROM public.duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (d.player1_id, d.player2_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF d.status NOT IN ('active','waiting_votes') THEN RAISE EXCEPTION 'Duel non litigeable'; END IF;
  UPDATE public.duels SET status = 'dispute', dispute_reason = p_reason,
    manual_review_requested_at = now(), manual_review_due_at = now() + interval '24 hours' WHERE id = d.id;
  PERFORM public._notify_admins('dispute_pending', 'Litige signalé', 'Un joueur a ouvert un litige.', '/admin');
END; $$;

-- =============== DEPOTS / RETRAITS ===============
CREATE OR REPLACE FUNCTION public.create_deposit(p_amount numeric, p_method public.payment_method,
  p_sender_name text, p_sender_phone text, p_reference text, p_screenshot text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid(); v_flags text[] := '{}'; v_score integer := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF COALESCE(TRIM(p_reference), '') = '' THEN RAISE EXCEPTION 'La référence de transaction est obligatoire'; END IF;
  IF EXISTS (SELECT 1 FROM public.deposits WHERE reference = TRIM(p_reference) AND status <> 'rejected') THEN
    RAISE EXCEPTION 'Cette référence de transaction a déjà été utilisée';
  END IF;
  IF (SELECT COUNT(*) FROM public.deposits WHERE user_id = v_me AND status = 'pending') >= 3 THEN
    v_flags := v_flags || 'multiples_depots_en_attente'; v_score := v_score + 40;
  END IF;
  IF p_amount > 500000 THEN v_flags := v_flags || 'montant_eleve'; v_score := v_score + 30; END IF;

  INSERT INTO public.deposits (user_id, amount, method, sender_name, sender_phone, reference, screenshot, fraud_score, fraud_flags)
  VALUES (v_me, p_amount, p_method, p_sender_name, p_sender_phone, TRIM(p_reference), p_screenshot, v_score, v_flags)
  RETURNING id INTO v_id;

  PERFORM public._notify_admins('deposit_pending', 'Dépôt à valider',
    'Dépôt de ' || p_amount || ' FCFA (réf. ' || TRIM(p_reference) || ') en attente.', '/admin');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_withdrawal(p_amount numeric, p_method public.payment_method, p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid(); v_bal numeric; v_flags text[] := '{}'; v_score integer := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount < 1000 THEN RAISE EXCEPTION 'Le retrait minimum est de 1 000 FCFA'; END IF;
  SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = v_me FOR UPDATE;
  IF v_bal < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = v_me AND status = 'pending') THEN
    RAISE EXCEPTION 'Vous avez déjà une demande de retrait en attente';
  END IF;
  IF (SELECT total_deposited FROM public.wallets WHERE user_id = v_me) = 0 THEN
    v_flags := v_flags || 'aucun_depot_prealable'; v_score := v_score + 50;
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, method, phone_number, net_amount, fraud_score, fraud_flags)
  VALUES (v_me, p_amount, p_method, p_phone, p_amount, v_score, v_flags) RETURNING id INTO v_id;

  UPDATE public.wallets SET balance_available = balance_available - p_amount,
    balance_locked = balance_locked + p_amount WHERE user_id = v_me;
  PERFORM public._record_tx(v_me, 'withdrawal', p_amount, v_bal, v_bal - p_amount, 'Demande de retrait en attente', NULL, NULL, v_id);

  PERFORM public._notify_admins('withdrawal_pending', 'Retrait à valider',
    'Retrait de ' || p_amount || ' FCFA en attente.', '/admin');
  RETURN v_id;
END; $$;

-- =============== PSEUDO ===============
CREATE OR REPLACE FUNCTION public.request_username_change(p_new_username text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid();
BEGIN
  IF COALESCE(TRIM(p_new_username),'') = '' THEN RAISE EXCEPTION 'Pseudo invalide'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(TRIM(p_new_username))) THEN
    RAISE EXCEPTION 'Ce pseudo est déjà pris';
  END IF;
  IF EXISTS (SELECT 1 FROM public.username_change_requests WHERE user_id = v_me AND status = 'pending') THEN
    RAISE EXCEPTION 'Une demande est déjà en cours';
  END IF;
  INSERT INTO public.username_change_requests (user_id, new_username, reason)
  VALUES (v_me, TRIM(p_new_username), p_reason) RETURNING id INTO v_id;
  PERFORM public._notify_admins('username_change_pending', 'Changement de pseudo',
    'Demande de changement vers « ' || TRIM(p_new_username) || ' ».', '/admin');
  RETURN v_id;
END; $$;

-- =============== ADMIN ===============
CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_deposit uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dp public.deposits%ROWTYPE; v_bal numeric;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO dp FROM public.deposits WHERE id = p_deposit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dépôt introuvable'; END IF;
  IF dp.status <> 'pending' THEN RAISE EXCEPTION 'Dépôt déjà traité'; END IF;

  IF p_approve THEN
    SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = dp.user_id FOR UPDATE;
    UPDATE public.wallets SET balance_available = balance_available + dp.amount,
      total_deposited = total_deposited + dp.amount WHERE user_id = dp.user_id;
    PERFORM public._record_tx(dp.user_id, 'deposit', dp.amount, v_bal, v_bal + dp.amount,
      'Dépôt validé (réf. ' || dp.reference || ')', NULL, dp.id);
    UPDATE public.deposits SET status = 'approved', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = dp.id;
    PERFORM public._notify(dp.user_id, 'deposit_approved', 'Dépôt validé', dp.amount || ' FCFA ont été crédités.', '/portefeuille');
  ELSE
    UPDATE public.deposits SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = dp.id;
    PERFORM public._notify(dp.user_id, 'deposit_rejected', 'Dépôt refusé', COALESCE(p_note, 'Référence non vérifiable.'), '/portefeuille');
  END IF;
  PERFORM public._admin_log(CASE WHEN p_approve THEN 'deposit_approved' ELSE 'deposit_rejected' END, 'Deposit', dp.id, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(p_withdrawal uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wd public.withdrawals%ROWTYPE; v_bal numeric;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO wd FROM public.withdrawals WHERE id = p_withdrawal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retrait introuvable'; END IF;
  IF wd.status <> 'pending' THEN RAISE EXCEPTION 'Retrait déjà traité'; END IF;

  IF p_approve THEN
    UPDATE public.wallets SET balance_locked = balance_locked - wd.amount,
      total_withdrawn = total_withdrawn + wd.amount WHERE user_id = wd.user_id;
    UPDATE public.withdrawals SET status = 'approved', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = wd.id;
    PERFORM public._notify(wd.user_id, 'withdrawal_approved', 'Retrait validé', wd.amount || ' FCFA envoyés vers ' || wd.phone_number || '.', '/portefeuille');
  ELSE
    SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = wd.user_id FOR UPDATE;
    UPDATE public.wallets SET balance_locked = balance_locked - wd.amount,
      balance_available = balance_available + wd.amount WHERE user_id = wd.user_id;
    PERFORM public._record_tx(wd.user_id, 'stake_refunded', wd.amount, v_bal, v_bal + wd.amount, 'Retrait refusé : montant restitué', NULL, NULL, wd.id);
    UPDATE public.withdrawals SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = wd.id;
    PERFORM public._notify(wd.user_id, 'withdrawal_rejected', 'Retrait refusé', COALESCE(p_note, 'Demande refusée.'), '/portefeuille');
  END IF;
  PERFORM public._admin_log(CASE WHEN p_approve THEN 'withdrawal_approved' ELSE 'withdrawal_rejected' END, 'Withdrawal', wd.id, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(p_duel uuid, p_resolution text, p_winner uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  PERFORM public._settle_duel(p_duel, p_resolution, p_winner, p_note);
  UPDATE public.duels SET resolved_by = auth.uid() WHERE id = p_duel;
  PERFORM public._admin_log('dispute_resolved', 'Duel', p_duel, p_note, jsonb_build_object('resolution', p_resolution, 'winner', p_winner));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user uuid, p_banned boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  UPDATE public.profiles SET is_banned = p_banned, status = CASE WHEN p_banned THEN 'banned'::public.user_status ELSE 'active'::public.user_status END WHERE id = p_user;
  PERFORM public._notify(p_user, 'account_status', CASE WHEN p_banned THEN 'Compte suspendu' ELSE 'Compte réactivé' END, COALESCE(p_note, ''), '/profil');
  PERFORM public._admin_log(CASE WHEN p_banned THEN 'user_banned' ELSE 'user_unbanned' END, 'User', p_user, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric;
BEGIN
  PERFORM public._require_admin();
  SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = p_user FOR UPDATE;
  IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'Ajustement impossible : solde négatif'; END IF;
  UPDATE public.wallets SET balance_available = balance_available + p_amount WHERE user_id = p_user;
  PERFORM public._record_tx(p_user, 'adjustment', p_amount, v_bal, v_bal + p_amount, COALESCE(p_note, 'Ajustement administrateur'));
  PERFORM public._notify(p_user, 'balance_adjusted', 'Solde ajusté', 'Ajustement de ' || p_amount || ' FCFA. ' || COALESCE(p_note,''), '/portefeuille');
  PERFORM public._admin_log('balance_adjusted', 'User', p_user, p_note, jsonb_build_object('amount', p_amount));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_username_change(p_request uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.username_change_requests%ROWTYPE;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO r FROM public.username_change_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Demande introuvable ou déjà traitée'; END IF;
  IF p_approve THEN
    UPDATE public.profiles SET username = r.new_username, efootball_username = r.new_username WHERE id = r.user_id;
    PERFORM public._notify(r.user_id, 'username_approved', 'Pseudo modifié', 'Votre pseudo est désormais « ' || r.new_username || ' ».', '/profil');
  ELSE
    PERFORM public._notify(r.user_id, 'username_rejected', 'Demande refusée', COALESCE(p_note, 'Changement de pseudo refusé.'), '/profil');
  END IF;
  UPDATE public.username_change_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.request_status,
    reviewed_by = auth.uid(), reviewed_at = now() WHERE id = r.id;
  PERFORM public._admin_log('username_change_reviewed', 'UsernameChangeRequest', r.id, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.expire_stale_challenges()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.challenges SET status = 'expired'
  WHERE status IN ('pending','counter_offer') AND expires_at < now();
$$;

-- Droits d'exécution
REVOKE ALL ON FUNCTION public._record_tx(uuid, public.tx_type, numeric, numeric, numeric, text, uuid, uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public._notify(uuid, text, text, text, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public._notify_admins(text, text, text, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public._admin_log(text, text, uuid, text, jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public._require_admin() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public._settle_duel(uuid, text, uuid, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.get_commission_rate(numeric) FROM anon, public;
REVOKE ALL ON FUNCTION public.create_challenge(uuid, numeric, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.respond_challenge(uuid, text, numeric) FROM anon, public;
REVOKE ALL ON FUNCTION public.submit_duel_vote(uuid, public.duel_vote) FROM anon, public;
REVOKE ALL ON FUNCTION public.open_duel_dispute(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.create_deposit(numeric, public.payment_method, text, text, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.create_withdrawal(numeric, public.payment_method, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.request_username_change(text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_review_deposit(uuid, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_review_username_change(uuid, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.expire_stale_challenges() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_commission_rate(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_challenge(uuid, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_challenge(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_duel_vote(uuid, public.duel_vote) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_duel_dispute(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_deposit(numeric, public.payment_method, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(numeric, public.payment_method, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_username_change(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_username_change(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_challenges() TO authenticated;