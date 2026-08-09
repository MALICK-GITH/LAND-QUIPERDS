-- ==========================================
-- SKILL2CASH — schéma initial
-- ==========================================

CREATE TYPE public.app_role AS ENUM ('player', 'admin');
CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE public.user_level AS ENUM ('Amateur', 'Pro', 'Elite');
CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','stake_locked','stake_refunded','win','loss','commission','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','completed','failed');
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.payment_method AS ENUM ('Wave','MTN');
CREATE TYPE public.challenge_status AS ENUM ('pending','counter_offer','accepted','declined','cancelled','expired');
CREATE TYPE public.duel_status AS ENUM ('active','waiting_votes','finished','dispute','cancelled');
CREATE TYPE public.duel_vote AS ENUM ('win','draw','lose');
CREATE TYPE public.commission_type AS ENUM ('small','medium','high','tournament');

-- ---------- PROFILS ----------
CREATE TABLE public.profiles (
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------- ROLES ----------
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- PORTEFEUILLES ----------
CREATE TABLE public.wallets (
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
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- TRANSACTIONS ----------
CREATE TABLE public.transactions (
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
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE INDEX idx_tx_user ON public.transactions(user_id, created_at DESC);

-- ---------- DEPOTS ----------
CREATE TABLE public.deposits (
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
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "deposits_admin_update" ON public.deposits FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- RETRAITS ----------
CREATE TABLE public.withdrawals (
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
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- DEFIS ----------
CREATE TABLE public.challenges (
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
GRANT SELECT, INSERT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_select_involved" ON public.challenges FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR challenged_id = auth.uid() OR public.is_admin());
CREATE POLICY "challenges_insert_own" ON public.challenges FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid() AND status = 'pending');

-- ---------- DUELS ----------
CREATE TABLE public.duels (
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
GRANT SELECT ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duels_select_involved" ON public.duels FOR SELECT TO authenticated
  USING (player1_id = auth.uid() OR player2_id = auth.uid() OR public.is_admin());

ALTER TABLE public.challenges ADD CONSTRAINT challenges_duel_fk
  FOREIGN KEY (duel_id) REFERENCES public.duels(id) ON DELETE SET NULL;

-- ---------- CHAT DE DUEL ----------
CREATE TABLE public.duel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.duel_messages TO authenticated;
GRANT ALL ON public.duel_messages TO service_role;
ALTER TABLE public.duel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duel_messages_select_involved" ON public.duel_messages FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.duels d WHERE d.id = duel_id
      AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())));
CREATE POLICY "duel_messages_insert_involved" ON public.duel_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.duels d WHERE d.id = duel_id
      AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())));

-- ---------- COMMISSIONS ----------
CREATE TABLE public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.commission_type NOT NULL,
  min_amount numeric(14,2) NOT NULL DEFAULT 0,
  max_amount numeric(14,2),
  rate numeric(6,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_select_authenticated" ON public.commission_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "commissions_admin_all" ON public.commission_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.commission_settings (name, type, min_amount, max_amount, rate) VALUES
  ('Petit enjeu', 'small', 0, 5000, 0.09),
  ('Enjeu moyen', 'medium', 5000.01, 25000, 0.08),
  ('Gros enjeu', 'high', 25000.01, NULL, 0.05),
  ('Tournoi', 'tournament', 0, NULL, 0.12);

-- ---------- JOURNAL ADMIN ----------
CREATE TABLE public.admin_logs (
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
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_admin_only" ON public.admin_logs FOR SELECT TO authenticated USING (public.is_admin());

-- ---------- CHANGEMENT DE PSEUDO ----------
CREATE TABLE public.username_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_username text NOT NULL,
  reason text,
  status public.request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.username_change_requests TO authenticated;
GRANT ALL ON public.username_change_requests TO service_role;
ALTER TABLE public.username_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ucr_select_own" ON public.username_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "ucr_insert_own" ON public.username_change_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "ucr_admin_update" ON public.username_change_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- NOTIFICATIONS ----------
CREATE TABLE public.notifications (
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
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND NOT is_admin_notice) OR (is_admin_notice AND public.is_admin()));
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND NOT is_admin_notice) OR (is_admin_notice AND public.is_admin()))
  WITH CHECK (true);

-- ---------- TRIGGERS ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Création automatique du profil + portefeuille à l'inscription
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
    NEW.id,
    v_username,
    v_efoot,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country',''), 'Cote d''Ivoire'),
    COALESCE((NEW.raw_user_meta_data->>'level')::public.user_level, 'Amateur')
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER TABLE public.duel_messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.duels REPLICA IDENTITY FULL;
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;