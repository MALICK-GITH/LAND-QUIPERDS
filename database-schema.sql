-- ==========================================
-- SKILL2CASH — Schéma de base de données complet
-- ==========================================
-- Ce fichier contient toutes les tables nécessaires pour la plateforme SKILL2CASH
-- Exécuter ce script dans votre base de données PostgreSQL/Supabase

-- ==========================================
-- TYPES ENUMÉRÉS
-- ==========================================

-- PostgreSQL ne supporte pas "IF NOT EXISTS" avec CREATE TYPE ENUM
-- On utilise DO block pour créer les types seulement s'ils n'existent pas

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.app_role AS ENUM ('player', 'admin');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_level' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.user_level AS ENUM ('Amateur', 'Pro', 'Elite');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','stake_locked','stake_refunded','win','loss','commission','adjustment');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.tx_status AS ENUM ('pending','completed','failed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.payment_method AS ENUM ('Wave','MTN');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.challenge_status AS ENUM ('pending','counter_offer','accepted','declined','cancelled','expired');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duel_status' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.duel_status AS ENUM ('active','waiting_votes','finished','dispute','cancelled');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duel_vote' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.duel_vote AS ENUM ('win','draw','lose');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.commission_type AS ENUM ('small','medium','high','tournament');
    END IF;
END $$;

-- ==========================================
-- TABLES PRINCIPALES
-- ==========================================

-- ---------- PROFILS UTILISATEURS ----------
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
  telegram_chat_id bigint,
  telegram_username text,
  telegram_linked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_key ON public.profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- ---------- RÔLES UTILISATEURS ----------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ---------- PORTEFEUILLES ----------
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

-- ---------- TRANSACTIONS ----------
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

-- ---------- DÉPÔTS ----------
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

-- ---------- RETRAITS ----------
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

-- ---------- DÉFIS ----------
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

-- ---------- DUELS ----------
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenges_duel_fk' 
        AND conrelid = 'public.challenges'::regclass
    ) THEN
        ALTER TABLE public.challenges ADD CONSTRAINT challenges_duel_fk
          FOREIGN KEY (duel_id) REFERENCES public.duels(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------- MESSAGES DE DUEL ----------
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'duel_messages_attachment_type_check' 
        AND conrelid = 'public.duel_messages'::regclass
    ) THEN
        ALTER TABLE public.duel_messages ADD CONSTRAINT duel_messages_attachment_type_check
          CHECK (attachment_type IS NULL OR attachment_type IN ('image/jpeg','image/png','image/webp'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'duel_messages_attachment_size_check' 
        AND conrelid = 'public.duel_messages'::regclass
    ) THEN
        ALTER TABLE public.duel_messages ADD CONSTRAINT duel_messages_attachment_size_check
          CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 5242880));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'duel_messages_evidence_requires_attachment' 
        AND conrelid = 'public.duel_messages'::regclass
    ) THEN
        ALTER TABLE public.duel_messages ADD CONSTRAINT duel_messages_evidence_requires_attachment
          CHECK (NOT is_dispute_evidence OR attachment_path IS NOT NULL);
    END IF;
END $$;

-- ---------- COMMISSIONS ----------
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

INSERT INTO public.commission_settings (name, type, min_amount, max_amount, rate) VALUES
  ('Petit enjeu', 'small', 0, 5000, 0.09),
  ('Enjeu moyen', 'medium', 5000.01, 25000, 0.08),
  ('Gros enjeu', 'high', 25000.01, NULL, 0.05),
  ('Tournoi', 'tournament', 0, NULL, 0.12)
ON CONFLICT DO NOTHING;

-- ---------- JOURNAL ADMIN ----------
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

-- ---------- CHANGEMENT DE PSEUDO ----------
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

-- ---------- NOTIFICATIONS ----------
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

-- ---------- MESSAGERIE PRIVÉE ----------
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
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_messages_conv_idx ON public.direct_messages (conversation_id, created_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'direct_messages_attachment_type_check' 
        AND conrelid = 'public.direct_messages'::regclass
    ) THEN
        ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_attachment_type_check
          CHECK (attachment_type IS NULL OR attachment_type IN ('image/jpeg','image/png','image/webp'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'direct_messages_attachment_size_check' 
        AND conrelid = 'public.direct_messages'::regclass
    ) THEN
        ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_attachment_size_check
          CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 5242880));
    END IF;
END $$;

-- ---------- INTÉGRATION TELEGRAM ----------
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at timestamptz
);

-- ---------- PARAMÈTRES APPLICATION ----------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings(key, value) VALUES
  ('telegram_notify_secret', 'a09db0e787dfeb5376ad89daa5da7dddc33b81d5968dacc2'),
  ('app_base_url', 'https://duel-diva-dash.lovable.app')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- TRIGGERS ET FONCTIONS UTILITAIRES
-- ==========================================

-- ---------- FONCTIONS D'AUTORISATION ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- FONCTIONS TELEGRAM ----------
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
END;
$$;
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
END;
$$;
REVOKE ALL ON FUNCTION public.unlink_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_telegram() TO authenticated;

-- ---------- TRIGGER UPDATED_AT ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_touch' AND tgrelid = 'public.profiles'::regclass) THEN
        CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallets_touch' AND tgrelid = 'public.wallets'::regclass) THEN
        CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets
          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversations_touch' AND tgrelid = 'public.conversations'::regclass) THEN
        CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- ==========================================
-- PERMISSIONS (ROW LEVEL SECURITY)
-- ==========================================

-- ---------- PROFILES ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_authenticated' AND tablename = 'profiles') THEN
        CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own' AND tablename = 'profiles') THEN
        CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
          USING (id = auth.uid()) WITH CHECK (id = auth.uid());
    END IF;
END $$;

-- ---------- USER_ROLES ----------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_roles_select_own' AND tablename = 'user_roles') THEN
        CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- ---------- WALLETS ----------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_select_own' AND tablename = 'wallets') THEN
        CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- ---------- TRANSACTIONS ----------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transactions_select_own' AND tablename = 'transactions') THEN
        CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- ---------- DEPOSITS ----------
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deposits_select_own' AND tablename = 'deposits') THEN
        CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deposits_insert_own' AND tablename = 'deposits') THEN
        CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT TO authenticated
          WITH CHECK (user_id = auth.uid() AND status = 'pending');
    END IF;
END $$;

-- ---------- WITHDRAWALS ----------
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'withdrawals_select_own' AND tablename = 'withdrawals') THEN
        CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- ---------- CHALLENGES ----------
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'challenges_select_involved' AND tablename = 'challenges') THEN
        CREATE POLICY "challenges_select_involved" ON public.challenges FOR SELECT TO authenticated
          USING (challenger_id = auth.uid() OR challenged_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'challenges_insert_own' AND tablename = 'challenges') THEN
        CREATE POLICY "challenges_insert_own" ON public.challenges FOR INSERT TO authenticated
          WITH CHECK (challenger_id = auth.uid() AND status = 'pending');
    END IF;
END $$;

-- ---------- DUELS ----------
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'duels_select_involved' AND tablename = 'duels') THEN
        CREATE POLICY "duels_select_involved" ON public.duels FOR SELECT TO authenticated
          USING (player1_id = auth.uid() OR player2_id = auth.uid());
    END IF;
END $$;

-- ---------- DUEL_MESSAGES ----------
ALTER TABLE public.duel_messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'duel_messages_select_involved' AND tablename = 'duel_messages') THEN
        CREATE POLICY "duel_messages_select_involved" ON public.duel_messages FOR SELECT TO authenticated
          USING (public.is_admin() OR EXISTS (
            SELECT 1 FROM public.duels d WHERE d.id = duel_id
              AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'duel_messages_insert_involved' AND tablename = 'duel_messages') THEN
        CREATE POLICY "duel_messages_insert_involved" ON public.duel_messages FOR INSERT TO authenticated
          WITH CHECK (sender_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.duels d WHERE d.id = duel_id
              AND (d.player1_id = auth.uid() OR d.player2_id = auth.uid())));
    END IF;
END $$;

-- ---------- COMMISSION_SETTINGS ----------
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'commissions_select_authenticated' AND tablename = 'commission_settings') THEN
        CREATE POLICY "commissions_select_authenticated" ON public.commission_settings FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- ---------- ADMIN_LOGS ----------
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_logs_admin_only' AND tablename = 'admin_logs') THEN
        CREATE POLICY "admin_logs_admin_only" ON public.admin_logs FOR SELECT TO authenticated USING (public.is_admin());
    END IF;
END $$;

-- ---------- USERNAME_CHANGE_REQUESTS ----------
ALTER TABLE public.username_change_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ucr_select_own' AND tablename = 'username_change_requests') THEN
        CREATE POLICY "ucr_select_own" ON public.username_change_requests FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ucr_insert_own' AND tablename = 'username_change_requests') THEN
        CREATE POLICY "ucr_insert_own" ON public.username_change_requests FOR INSERT TO authenticated
          WITH CHECK (user_id = auth.uid() AND status = 'pending');
    END IF;
END $$;

-- ---------- NOTIFICATIONS ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_select' AND tablename = 'notifications') THEN
        CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
          USING ((user_id = auth.uid() AND NOT is_admin_notice) OR (is_admin_notice AND public.is_admin()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_update_own' AND tablename = 'notifications') THEN
        CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
          USING ((user_id = auth.uid() AND NOT is_admin_notice) OR (is_admin_notice AND public.is_admin()))
          WITH CHECK (true);
    END IF;
END $$;

-- ---------- CONVERSATIONS ----------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_select_member' AND tablename = 'conversations') THEN
        CREATE POLICY conversations_select_member ON public.conversations
          FOR SELECT TO authenticated
          USING (user_low = auth.uid() OR user_high = auth.uid());
    END IF;
END $$;

-- ---------- DIRECT_MESSAGES ----------
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dm_select_member' AND tablename = 'direct_messages') THEN
        CREATE POLICY dm_select_member ON public.direct_messages
          FOR SELECT TO authenticated
          USING (EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = direct_messages.conversation_id
              AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
          ));
    END IF;
END $$;

-- ---------- TELEGRAM_LINK_CODES ----------
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tlc_select_own' AND tablename = 'telegram_link_codes') THEN
        CREATE POLICY "tlc_select_own" ON public.telegram_link_codes FOR SELECT TO authenticated
          USING (user_id = auth.uid());
    END IF;
END $$;

-- ---------- APP_SETTINGS ----------
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- REALTIME (Supabase)
-- ==========================================

DO $$
BEGIN
    -- Set replica identity for realtime tables
    ALTER TABLE public.duel_messages REPLICA IDENTITY FULL;
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
    ALTER TABLE public.duels REPLICA IDENTITY FULL;
    ALTER TABLE public.challenges REPLICA IDENTITY FULL;
    ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
    ALTER TABLE public.conversations REPLICA IDENTITY FULL;
    
    -- Add tables to publication (ignore if already added)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_messages;
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    EXCEPTION WHEN duplicate_object THEN null; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN null; END;
END $$;

-- ==========================================
-- FIN DU SCHÉMA
-- ==========================================
