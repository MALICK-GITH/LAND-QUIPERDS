-- 1) Messagerie privée
CREATE TABLE public.conversations (
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

GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_member ON public.conversations
  FOR SELECT TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());

CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX direct_messages_conv_idx ON public.direct_messages (conversation_id, created_at);

GRANT SELECT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_select_member ON public.direct_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = direct_messages.conversation_id
      AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
  ));

-- 2) Fonctions messagerie
CREATE OR REPLACE FUNCTION public.start_conversation(p_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_low uuid; v_high uuid; v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_other IS NULL OR p_other = v_me THEN RAISE EXCEPTION 'Destinataire invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other) THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;
  v_low := LEAST(v_me, p_other); v_high := GREATEST(v_me, p_other);
  SELECT id INTO v_id FROM public.conversations WHERE user_low = v_low AND user_high = v_high;
  IF v_id IS NULL THEN
    INSERT INTO public.conversations (user_low, user_high) VALUES (v_low, v_high) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_conversation uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations%ROWTYPE; v_me uuid := auth.uid(); v_other uuid; v_id uuid; v_text text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  v_text := TRIM(COALESCE(p_body, ''));
  IF v_text = '' THEN RAISE EXCEPTION 'Message vide'; END IF;
  v_text := LEFT(v_text, 2000);
  SELECT * INTO c FROM public.conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.user_low, c.user_high) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_me AND is_banned) THEN
    RAISE EXCEPTION 'Compte suspendu : envoi impossible';
  END IF;
  v_other := CASE WHEN v_me = c.user_low THEN c.user_high ELSE c.user_low END;

  INSERT INTO public.direct_messages (conversation_id, sender_id, body)
  VALUES (p_conversation, v_me, v_text) RETURNING id INTO v_id;

  UPDATE public.conversations
    SET last_message_at = now(), last_message_preview = LEFT(v_text, 120)
    WHERE id = p_conversation;

  PERFORM public._notify(v_other, 'message_received', 'Nouveau message',
    LEFT(v_text, 120), '/messages?c=' || p_conversation);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation AND (c.user_low = v_me OR c.user_high = v_me)
  ) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.direct_messages SET read_at = now()
    WHERE conversation_id = p_conversation AND sender_id <> v_me AND read_at IS NULL;
END; $$;

REVOKE EXECUTE ON FUNCTION public.start_conversation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- 3) Liste des administrateurs
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE (id uuid, username text, level user_level, badge text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.level, p.badge, p.country, p.created_at
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'admin'
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;

-- 4) Fermeture automatique du chat de duel une fois le duel réglé
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

-- 5) Temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;