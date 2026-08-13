-- SKILL2CASH / LAND-QUIPERDS
-- Clean Supabase bootstrap script.
-- Execute this file from top to bottom in a fresh database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('player', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_level AS ENUM ('Amateur', 'Pro', 'Elite'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','stake_locked','stake_refunded','win','loss','commission','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tx_status AS ENUM ('pending','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('Wave','MTN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.challenge_status AS ENUM ('pending','counter_offer','accepted','declined','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.duel_status AS ENUM ('active','waiting_votes','finished','dispute','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.duel_vote AS ENUM ('win','draw','lose'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.commission_type AS ENUM ('small','medium','high','tournament'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  efootball_username text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  country text NOT NULL DEFAULT 'Cote d''Ivoire',
  level public.user_level NOT NULL DEFAULT 'Amateur',
  status public.user_status NOT NULL DEFAULT 'active',
  rank integer,
  badge text,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  total_earnings numeric(14,2) NOT NULL DEFAULT 0,
  reputation integer NOT NULL DEFAULT 100,
  reports_count integer NOT NULL DEFAULT 0,
  is_banned boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  telegram_chat_id bigint,
  telegram_username text,
  telegram_linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_key
  ON public.profiles (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_available numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance_available >= 0),
  balance_locked numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance_locked >= 0),
  total_deposited numeric(14,2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(14,2) NOT NULL DEFAULT 0,
  total_won numeric(14,2) NOT NULL DEFAULT 0,
  total_lost numeric(14,2) NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  type public.tx_type NOT NULL,
  amount numeric(14,2) NOT NULL,
  balance_before numeric(14,2),
  balance_after numeric(14,2),
  status public.tx_status NOT NULL DEFAULT 'completed',
  description text,
  related_duel uuid,
  related_deposit uuid,
  related_withdrawal uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON public.transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  reference text NOT NULL,
  screenshot text,
  status public.request_status NOT NULL DEFAULT 'pending',
  fraud_score integer NOT NULL DEFAULT 0,
  fraud_flags text[] NOT NULL DEFAULT '{}',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  phone_number text NOT NULL,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.request_status NOT NULL DEFAULT 'pending',
  fraud_score integer NOT NULL DEFAULT 0,
  fraud_flags text[] NOT NULL DEFAULT '{}',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  accepted_amount numeric(14,2),
  status public.challenge_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  duel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_id <> challenged_id)
);

CREATE TABLE IF NOT EXISTS public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  commission_rate numeric(6,4) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.duel_status NOT NULL DEFAULT 'active',
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  player1_vote public.duel_vote,
  player2_vote public.duel_vote,
  player1_voted_at timestamptz,
  player2_voted_at timestamptz,
  winner_id uuid,
  loser_id uuid,
  is_draw boolean NOT NULL DEFAULT false,
  dispute_reason text,
  manual_review_requested_at timestamptz,
  manual_review_due_at timestamptz,
  resolved_by uuid,
  admin_note text,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pair_unique UNIQUE (user_low, user_high),
  CONSTRAINT conversations_ordered CHECK (user_low < user_high)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_messages_conv_idx
  ON public.direct_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.duel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  is_dispute_evidence boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.commission_type NOT NULL,
  min_amount numeric(14,2) NOT NULL DEFAULT 0,
  max_amount numeric(14,2),
  rate numeric(6,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}',
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.username_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_username text NOT NULL,
  reason text,
  status public.request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin_notice boolean NOT NULL DEFAULT false,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- AUTH HELPERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- -----------------------------------------------------------------------------
-- RLS + GRANTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.username_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
GRANT SELECT, INSERT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
GRANT SELECT ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
GRANT SELECT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
GRANT SELECT, INSERT ON public.duel_messages TO authenticated;
GRANT ALL ON public.duel_messages TO service_role;
GRANT SELECT ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
GRANT SELECT, INSERT ON public.username_change_requests TO authenticated;
GRANT ALL ON public.username_change_requests TO service_role;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS deposits_select_own ON public.deposits;
CREATE POLICY deposits_select_own ON public.deposits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS deposits_insert_own ON public.deposits;
CREATE POLICY deposits_insert_own ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS deposits_admin_update ON public.deposits;
CREATE POLICY deposits_admin_update ON public.deposits
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS challenges_select_involved ON public.challenges;
CREATE POLICY challenges_select_involved ON public.challenges
  FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR challenged_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS challenges_insert_own ON public.challenges;
CREATE POLICY challenges_insert_own ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS duels_select_involved ON public.duels;
CREATE POLICY duels_select_involved ON public.duels
  FOR SELECT TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS conversations_select_member ON public.conversations;
CREATE POLICY conversations_select_member ON public.conversations
  FOR SELECT TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());

DROP POLICY IF EXISTS dm_select_member ON public.direct_messages;
CREATE POLICY dm_select_member ON public.direct_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS duel_messages_select_involved ON public.duel_messages;
CREATE POLICY duel_messages_select_involved ON public.duel_messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.duels d
      WHERE d.id = duel_messages.duel_id
        AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS duel_messages_insert_involved ON public.duel_messages;
CREATE POLICY duel_messages_insert_involved ON public.duel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.duels d
      WHERE d.id = duel_messages.duel_id
        AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())
        AND d.status IN ('active','waiting_votes','dispute')
    )
  );

DROP POLICY IF EXISTS commissions_select_authenticated ON public.commission_settings;
CREATE POLICY commissions_select_authenticated ON public.commission_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS commissions_admin_all ON public.commission_settings;
CREATE POLICY commissions_admin_all ON public.commission_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_logs_admin_only ON public.admin_logs;
CREATE POLICY admin_logs_admin_only ON public.admin_logs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS ucr_select_own ON public.username_change_requests;
CREATE POLICY ucr_select_own ON public.username_change_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS ucr_insert_own ON public.username_change_requests;
CREATE POLICY ucr_insert_own ON public.username_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS ucr_admin_update ON public.username_change_requests;
CREATE POLICY ucr_admin_update ON public.username_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND NOT is_admin_notice)
    OR (is_admin_notice AND public.is_admin())
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND NOT is_admin_notice)
    OR (is_admin_notice AND public.is_admin())
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS tlc_select_own ON public.telegram_link_codes;
CREATE POLICY tlc_select_own ON public.telegram_link_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- GENERIC TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS wallets_touch ON public.wallets;
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS conversations_touch ON public.conversations;
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- NOTIFICATION / WALLET HELPERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_commission_rate(p_amount numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

-- -----------------------------------------------------------------------------
-- CORE FEATURES
-- -----------------------------------------------------------------------------
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
  PERFORM public._notify(p_challenged, 'challenge_received', 'Nouveau défi reçu', 'Vous avez reçu un défi de ' || p_amount || ' FCFA.', '/defis');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_challenge(p_challenge uuid, p_action text, p_counter_amount numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.challenges%ROWTYPE; v_me uuid := auth.uid(); v_amount numeric; v_rate numeric; v_duel uuid; v_b1 numeric; v_b2 numeric; v_responder uuid;
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
    PERFORM public._notify(CASE WHEN v_me = c.challenger_id THEN c.challenged_id ELSE c.challenger_id END, 'challenge_declined', 'Défi refusé', 'Votre défi a été refusé.', '/defis');
    RETURN NULL;
  END IF;
  IF p_action = 'counter' THEN
    IF p_counter_amount IS NULL OR p_counter_amount <= 0 THEN RAISE EXCEPTION 'Montant de contre-offre invalide'; END IF;
    UPDATE public.challenges SET status = 'counter_offer', accepted_amount = p_counter_amount WHERE id = c.id;
    PERFORM public._notify(c.challenger_id, 'challenge_counter', 'Contre-offre reçue', 'Nouvelle proposition : ' || p_counter_amount || ' FCFA.', '/defis');
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
  UPDATE public.wallets SET balance_available = balance_available - v_amount, balance_locked = balance_locked + v_amount WHERE user_id = c.challenger_id;
  UPDATE public.wallets SET balance_available = balance_available - v_amount, balance_locked = balance_locked + v_amount WHERE user_id = c.challenged_id;
  PERFORM public._record_tx(c.challenger_id, 'stake_locked', v_amount, v_b1, v_b1 - v_amount, 'Mise bloquée pour le duel', v_duel);
  PERFORM public._record_tx(c.challenged_id, 'stake_locked', v_amount, v_b2, v_b2 - v_amount, 'Mise bloquée pour le duel', v_duel);
  UPDATE public.challenges SET status = 'accepted', duel_id = v_duel, accepted_amount = v_amount WHERE id = c.id;
  PERFORM public._notify(c.challenger_id, 'duel_started', 'Duel lancé', 'Votre duel de ' || v_amount || ' FCFA a démarré.', '/duels/' || v_duel);
  PERFORM public._notify(c.challenged_id, 'duel_started', 'Duel lancé', 'Votre duel de ' || v_amount || ' FCFA a démarré.', '/duels/' || v_duel);
  RETURN v_duel;
END; $$;

CREATE OR REPLACE FUNCTION public._settle_duel(p_duel uuid, p_outcome text, p_winner uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.duels%ROWTYPE; v_pot numeric; v_com numeric; v_loser uuid; v_bw numeric; v_bl numeric; v_b1 numeric; v_b2 numeric; v_refund numeric; v_payout numeric;
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
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount, balance_available = balance_available + v_payout, total_won = total_won + (v_payout - d.amount) WHERE user_id = p_winner;
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount, total_lost = total_lost + d.amount WHERE user_id = v_loser;
    PERFORM public._record_tx(p_winner, 'win', v_payout, v_bw, v_bw + v_payout, 'Gain du duel', d.id);
    PERFORM public._record_tx(p_winner, 'commission', v_com, NULL, NULL, 'Commission plateforme', d.id);
    PERFORM public._record_tx(v_loser, 'loss', d.amount, v_bl, v_bl, 'Mise perdue', d.id);
    UPDATE public.profiles SET wins = wins + 1, current_streak = current_streak + 1, total_earnings = total_earnings + (v_payout - d.amount) WHERE id = p_winner;
    UPDATE public.profiles SET losses = losses + 1, current_streak = 0 WHERE id = v_loser;
    UPDATE public.duels SET status = 'finished', winner_id = p_winner, loser_id = v_loser, is_draw = false, commission_amount = v_com, finished_at = now(), admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
    PERFORM public._notify(p_winner, 'duel_won', 'Duel gagné', 'Vous avez remporté ' || v_payout || ' FCFA.', '/duels/' || d.id);
    PERFORM public._notify(v_loser, 'duel_lost', 'Duel perdu', 'Vous avez perdu votre mise de ' || d.amount || ' FCFA.', '/duels/' || d.id);
  ELSIF p_outcome = 'draw' THEN
    v_refund := d.amount - ROUND(v_com / 2, 2);
    SELECT balance_available INTO v_b1 FROM public.wallets WHERE user_id = d.player1_id FOR UPDATE;
    SELECT balance_available INTO v_b2 FROM public.wallets WHERE user_id = d.player2_id FOR UPDATE;
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount, balance_available = balance_available + v_refund WHERE user_id IN (d.player1_id, d.player2_id);
    PERFORM public._record_tx(d.player1_id, 'stake_refunded', v_refund, v_b1, v_b1 + v_refund, 'Match nul : remboursement partiel', d.id);
    PERFORM public._record_tx(d.player2_id, 'stake_refunded', v_refund, v_b2, v_b2 + v_refund, 'Match nul : remboursement partiel', d.id);
    PERFORM public._record_tx(d.player1_id, 'commission', ROUND(v_com / 2, 2), NULL, NULL, 'Commission plateforme (nul)', d.id);
    PERFORM public._record_tx(d.player2_id, 'commission', ROUND(v_com / 2, 2), NULL, NULL, 'Commission plateforme (nul)', d.id);
    UPDATE public.profiles SET draws = draws + 1, current_streak = 0 WHERE id IN (d.player1_id, d.player2_id);
    UPDATE public.duels SET status = 'finished', is_draw = true, commission_amount = v_com, finished_at = now(), admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
    PERFORM public._notify(d.player1_id, 'duel_draw', 'Match nul', 'Remboursement de ' || v_refund || ' FCFA.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_draw', 'Match nul', 'Remboursement de ' || v_refund || ' FCFA.', '/duels/' || d.id);
  ELSIF p_outcome = 'cancel' THEN
    SELECT balance_available INTO v_b1 FROM public.wallets WHERE user_id = d.player1_id FOR UPDATE;
    SELECT balance_available INTO v_b2 FROM public.wallets WHERE user_id = d.player2_id FOR UPDATE;
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount, balance_available = balance_available + d.amount WHERE user_id IN (d.player1_id, d.player2_id);
    PERFORM public._record_tx(d.player1_id, 'stake_refunded', d.amount, v_b1, v_b1 + d.amount, 'Duel annulé : remboursement intégral', d.id);
    PERFORM public._record_tx(d.player2_id, 'stake_refunded', d.amount, v_b2, v_b2 + d.amount, 'Duel annulé : remboursement intégral', d.id);
    UPDATE public.duels SET status = 'cancelled', commission_amount = 0, finished_at = now(), admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
    PERFORM public._notify(d.player1_id, 'duel_cancelled', 'Duel annulé', 'Votre mise a été remboursée.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'duel_cancelled', 'Duel annulé', 'Votre mise a été remboursée.', '/duels/' || d.id);
  ELSIF p_outcome = 'cancel_no_refund' THEN
    UPDATE public.wallets SET balance_locked = balance_locked - d.amount, total_lost = total_lost + d.amount WHERE user_id IN (d.player1_id, d.player2_id);
    PERFORM public._record_tx(d.player1_id, 'loss', d.amount, NULL, NULL, 'Duel annulé sans remboursement', d.id);
    PERFORM public._record_tx(d.player2_id, 'loss', d.amount, NULL, NULL, 'Duel annulé sans remboursement', d.id);
    UPDATE public.duels SET status = 'cancelled', commission_amount = v_pot, finished_at = now(), admin_note = COALESCE(p_note, admin_note) WHERE id = d.id;
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
    UPDATE public.duels SET status = 'dispute', dispute_reason = 'Votes incohérents', manual_review_requested_at = now(), manual_review_due_at = now() + interval '24 hours' WHERE id = d.id;
    PERFORM public._notify_admins('dispute_pending', 'Litige à arbitrer', 'Un duel est en litige.', '/admin');
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
  UPDATE public.duels SET status = 'dispute', dispute_reason = p_reason, manual_review_requested_at = now(), manual_review_due_at = now() + interval '24 hours' WHERE id = d.id;
  PERFORM public._notify_admins('dispute_pending', 'Litige signalé', 'Un joueur a ouvert un litige.', '/admin');
END; $$;

CREATE OR REPLACE FUNCTION public.create_deposit(p_amount numeric, p_method public.payment_method, p_sender_name text, p_sender_phone text, p_reference text, p_screenshot text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid(); v_flags text[] := '{}'; v_score integer := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF COALESCE(TRIM(p_reference), '') = '' THEN RAISE EXCEPTION 'La référence de transaction est obligatoire'; END IF;
  IF EXISTS (SELECT 1 FROM public.deposits WHERE reference = TRIM(p_reference) AND status <> 'rejected') THEN RAISE EXCEPTION 'Cette référence de transaction a déjà été utilisée'; END IF;
  INSERT INTO public.deposits (user_id, amount, method, sender_name, sender_phone, reference, screenshot, fraud_score, fraud_flags)
  VALUES (v_me, p_amount, p_method, p_sender_name, p_sender_phone, TRIM(p_reference), p_screenshot, v_score, v_flags) RETURNING id INTO v_id;
  PERFORM public._notify_admins('deposit_pending', 'Dépôt à valider', 'Dépôt de ' || p_amount || ' FCFA en attente.', '/admin');
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
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = v_me AND status = 'pending') THEN RAISE EXCEPTION 'Vous avez déjà une demande de retrait en attente'; END IF;
  INSERT INTO public.withdrawals (user_id, amount, method, phone_number, net_amount, fraud_score, fraud_flags)
  VALUES (v_me, p_amount, p_method, p_phone, p_amount, v_score, v_flags) RETURNING id INTO v_id;
  UPDATE public.wallets SET balance_available = balance_available - p_amount, balance_locked = balance_locked + p_amount WHERE user_id = v_me;
  PERFORM public._record_tx(v_me, 'withdrawal', p_amount, v_bal, v_bal - p_amount, 'Demande de retrait en attente', NULL, NULL, v_id);
  PERFORM public._notify_admins('withdrawal_pending', 'Retrait à valider', 'Retrait de ' || p_amount || ' FCFA en attente.', '/admin');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.request_username_change(p_new_username text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid();
BEGIN
  IF COALESCE(TRIM(p_new_username),'') = '' THEN RAISE EXCEPTION 'Pseudo invalide'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(TRIM(p_new_username))) THEN RAISE EXCEPTION 'Ce pseudo est déjà pris'; END IF;
  IF EXISTS (SELECT 1 FROM public.username_change_requests WHERE user_id = v_me AND status = 'pending') THEN RAISE EXCEPTION 'Une demande est déjà en cours'; END IF;
  INSERT INTO public.username_change_requests (user_id, new_username, reason) VALUES (v_me, TRIM(p_new_username), p_reason) RETURNING id INTO v_id;
  PERFORM public._notify_admins('username_change_pending', 'Changement de pseudo', 'Demande de changement de pseudo en attente.', '/admin');
  RETURN v_id;
END; $$;

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
    UPDATE public.wallets SET balance_available = balance_available + dp.amount, total_deposited = total_deposited + dp.amount WHERE user_id = dp.user_id;
    PERFORM public._record_tx(dp.user_id, 'deposit', dp.amount, v_bal, v_bal + dp.amount, 'Dépôt validé (' || dp.reference || ')', NULL, dp.id);
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
    UPDATE public.wallets SET balance_locked = balance_locked - wd.amount, total_withdrawn = total_withdrawn + wd.amount WHERE user_id = wd.user_id;
    UPDATE public.withdrawals SET status = 'approved', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = wd.id;
    PERFORM public._notify(wd.user_id, 'withdrawal_approved', 'Retrait validé', wd.amount || ' FCFA envoyés vers ' || wd.phone_number || '.', '/portefeuille');
  ELSE
    SELECT balance_available INTO v_bal FROM public.wallets WHERE user_id = wd.user_id FOR UPDATE;
    UPDATE public.wallets SET balance_locked = balance_locked - wd.amount, balance_available = balance_available + wd.amount WHERE user_id = wd.user_id;
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
  UPDATE public.username_change_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.request_status, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = r.id;
  PERFORM public._admin_log('username_change_reviewed', 'UsernameChangeRequest', r.id, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.start_conversation(p_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_low uuid; v_high uuid; v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_other IS NULL OR p_other = v_me THEN RAISE EXCEPTION 'Destinataire invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other) THEN RAISE EXCEPTION 'Utilisateur introuvable'; END IF;
  v_low := LEAST(v_me, p_other); v_high := GREATEST(v_me, p_other);
  SELECT id INTO v_id FROM public.conversations WHERE user_low = v_low AND user_high = v_high;
  IF v_id IS NULL THEN INSERT INTO public.conversations (user_low, user_high) VALUES (v_low, v_high) RETURNING id INTO v_id; END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_conversation uuid, p_body text, p_attachment_path text DEFAULT NULL, p_attachment_name text DEFAULT NULL, p_attachment_type text DEFAULT NULL, p_attachment_size integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations%ROWTYPE; v_me uuid := auth.uid(); v_other uuid; v_id uuid; v_text text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  v_text := LEFT(TRIM(COALESCE(p_body, '')), 2000);
  IF v_text = '' AND p_attachment_path IS NULL THEN RAISE EXCEPTION 'Message vide'; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.user_low, c.user_high) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  v_other := CASE WHEN v_me = c.user_low THEN c.user_high ELSE c.user_low END;
  INSERT INTO public.direct_messages (conversation_id, sender_id, body, attachment_path, attachment_name, attachment_type, attachment_size)
  VALUES (p_conversation, v_me, v_text, p_attachment_path, p_attachment_name, p_attachment_type, p_attachment_size)
  RETURNING id INTO v_id;
  UPDATE public.conversations SET last_message_at = now(), last_message_preview = LEFT(v_text, 120) WHERE id = p_conversation;
  PERFORM public._notify(v_other, 'message_received', 'Nouveau message', LEFT(v_text, 120), '/messages?c=' || p_conversation);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation AND (c.user_low = v_me OR c.user_high = v_me)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  UPDATE public.direct_messages SET read_at = now() WHERE conversation_id = p_conversation AND sender_id <> v_me AND read_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE (id uuid, username text, level public.user_level, badge text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.level, p.badge, p.country, p.created_at
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'admin'
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at;
$$;

CREATE OR REPLACE FUNCTION public.create_telegram_link_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.telegram_link_codes WHERE user_id = auth.uid() AND used_at IS NULL;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.telegram_link_codes(code, user_id) VALUES (v_code, auth.uid());
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.unlink_telegram()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL WHERE id = auth.uid();
  DELETE FROM public.telegram_link_codes WHERE user_id = auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.forward_notification_to_telegram()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_chat bigint; v_secret text; v_base text;
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

CREATE OR REPLACE FUNCTION public.expire_stale_challenges()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.challenges SET status = 'expired'
  WHERE status IN ('pending','counter_offer') AND expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.process_settlement_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.duels%ROWTYPE; v_vote public.duel_vote; v_voter uuid; v_other uuid;
BEGIN
  PERFORM public.expire_stale_challenges();
  FOR d IN SELECT * FROM public.duels
    WHERE status IN ('active','waiting_votes')
      AND ((player1_vote IS NULL) <> (player2_vote IS NULL))
      AND COALESCE(player1_voted_at, player2_voted_at) < now() - interval '24 hours'
  LOOP
    IF d.player1_vote IS NOT NULL THEN v_vote := d.player1_vote; v_voter := d.player1_id; v_other := d.player2_id;
    ELSE v_vote := d.player2_vote; v_voter := d.player2_id; v_other := d.player1_id; END IF;
    IF v_vote = 'draw' THEN PERFORM public._settle_duel(d.id, 'draw', NULL, 'Auto-closed after 24h of silence.');
    ELSIF v_vote = 'win' THEN PERFORM public._settle_duel(d.id, 'winner', v_voter, 'Auto-closed after 24h of silence.');
    ELSE PERFORM public._settle_duel(d.id, 'winner', v_other, 'Auto-closed after 24h of silence.');
    END IF;
    PERFORM public._notify(v_voter, 'duel_auto_closed', 'Duel clôturé automatiquement', 'Votre adversaire n''a pas voté à temps.', '/duels/' || d.id);
    PERFORM public._notify(v_other, 'duel_auto_closed', 'Duel clôturé automatiquement', 'Le duel a été clôturé automatiquement.', '/duels/' || d.id);
  END LOOP;
  FOR d IN SELECT * FROM public.duels WHERE status = 'dispute' AND manual_review_due_at IS NOT NULL AND manual_review_due_at < now()
  LOOP
    PERFORM public._settle_duel(d.id, 'cancel', NULL, 'Auto-closed: dispute timeout, funds refunded.');
    PERFORM public._notify(d.player1_id, 'dispute_auto_closed', 'Litige clôturé automatiquement', 'Aucune revue admin n''est arrivée à temps.', '/duels/' || d.id);
    PERFORM public._notify(d.player2_id, 'dispute_auto_closed', 'Litige clôturé automatiquement', 'Aucune revue admin n''est arrivée à temps.', '/duels/' || d.id);
  END LOOP;
END; $$;

-- -----------------------------------------------------------------------------
-- AUTH TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_username text; v_efoot text;
BEGIN
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1)
  );
  v_efoot := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'efootball_username', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    v_username
  );
  INSERT INTO public.profiles (id, username, efootball_username, first_name, last_name, country, level)
  VALUES (
    NEW.id,
    v_username,
    v_efoot,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'Cote d''Ivoire'),
    COALESCE((NEW.raw_user_meta_data->>'level')::public.user_level, 'Amateur')
  );
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  IF lower(NEW.email) = 'onexdelux@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET level = 'Elite', badge = 'FONDATEUR' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- STORAGE
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-evidence', 'chat-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_evidence_upload_own_folder ON storage.objects;
CREATE POLICY chat_evidence_upload_own_folder ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS chat_evidence_read_participants ON storage.objects;
CREATE POLICY chat_evidence_read_participants ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-evidence'
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.direct_messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.attachment_path = storage.objects.name
        AND auth.uid() IN (c.user_low, c.user_high)
    )
    OR EXISTS (
      SELECT 1 FROM public.duel_messages m
      JOIN public.duels d ON d.id = m.duel_id
      WHERE m.attachment_path = storage.objects.name
        AND (auth.uid() IN (d.player1_id, d.player2_id) OR public.is_admin())
    )
  )
);

DROP POLICY IF EXISTS chat_evidence_delete_own ON storage.objects;
CREATE POLICY chat_evidence_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-evidence' AND owner_id = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- REALTIME
-- -----------------------------------------------------------------------------
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.duels REPLICA IDENTITY FULL;
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.duel_messages REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.duels; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_messages; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- EXECUTE PRIVILEGES
-- -----------------------------------------------------------------------------
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
REVOKE ALL ON FUNCTION public.process_settlement_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, text, text, text, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_telegram_link_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_telegram() FROM PUBLIC, anon;

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
GRANT EXECUTE ON FUNCTION public.process_settlement_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_telegram_link_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_telegram() TO authenticated;

COMMIT;
