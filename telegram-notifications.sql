-- Script pour ajouter les notifications Telegram push
-- Exécuter ce script dans l'éditeur SQL Supabase
-- IMPORTANT: Exécutez d'abord drop-notify-function.sql avant ce script

-- 1. Créer la table pour la file d'attente des notifications Telegram
CREATE TABLE IF NOT EXISTS public.telegram_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0
);

-- 2. Créer des index pour la file d'attente
CREATE INDEX IF NOT EXISTS idx_telegram_queue_user ON public.telegram_notification_queue(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_pending ON public.telegram_notification_queue(sent_at) WHERE sent_at IS NULL;

-- 3. Créer une fonction pour ajouter une notification à la file d'attente
CREATE OR REPLACE FUNCTION public.queue_telegram_notification(p_user_id uuid, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.telegram_notification_queue (user_id, title, body, link)
  VALUES (p_user_id, p_title, p_body, p_link)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END; $$;

-- 4. Modifier _notify pour aussi mettre en file d'attente les notifications Telegram
CREATE OR REPLACE FUNCTION public._notify(p_user_id uuid, p_type text, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insérer la notification dans la table
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
  
  -- Mettre en file d'attente pour Telegram
  PERFORM public.queue_telegram_notification(p_user_id, p_title, p_body, p_link);
END; $$;

-- 5. Créer une fonction pour envoyer des notifications Telegram (optionnelle)
CREATE OR REPLACE FUNCTION public.send_telegram_notification(p_user_id uuid, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chat_id bigint;
BEGIN
  -- Récupérer le chat_id Telegram de l'utilisateur
  SELECT telegram_chat_id INTO v_chat_id
  FROM public.profiles
  WHERE id = p_user_id AND telegram_chat_id IS NOT NULL;
  
  IF v_chat_id IS NULL THEN
    RETURN false; -- Utilisateur n'a pas lié son Telegram
  END IF;
  
  -- Pour l'instant, nous retournons true car l'envoi direct depuis SQL n'est pas recommandé
  -- L'envoi devrait se faire via l'application web qui a accès aux variables d'environnement
  
  RETURN true;
END; $$;

-- 6. Créer une fonction pour notifier les administrateurs
CREATE OR REPLACE FUNCTION public._notify_admins(p_type text, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_record RECORD;
BEGIN
  FOR v_admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM public._notify(v_admin_record.user_id, p_type, p_title, p_body, p_link);
  END LOOP;
END; $$;

-- Vérification
SELECT 
    'Notifications Telegram configurées' as status,
    (SELECT COUNT(*) FROM public.telegram_notification_queue) as queue_count;
