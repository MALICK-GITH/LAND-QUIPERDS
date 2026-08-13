ALTER TABLE public.direct_messages
  ADD COLUMN attachment_path text,
  ADD COLUMN attachment_name text,
  ADD COLUMN attachment_type text,
  ADD COLUMN attachment_size integer;

ALTER TABLE public.duel_messages
  ADD COLUMN attachment_path text,
  ADD COLUMN attachment_name text,
  ADD COLUMN attachment_type text,
  ADD COLUMN attachment_size integer,
  ADD COLUMN is_dispute_evidence boolean NOT NULL DEFAULT false;

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image/jpeg','image/png','image/webp')),
  ADD CONSTRAINT direct_messages_attachment_size_check
  CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 5242880));

ALTER TABLE public.duel_messages
  ADD CONSTRAINT duel_messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image/jpeg','image/png','image/webp')),
  ADD CONSTRAINT duel_messages_attachment_size_check
  CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 5242880)),
  ADD CONSTRAINT duel_messages_evidence_requires_attachment
  CHECK (NOT is_dispute_evidence OR attachment_path IS NOT NULL);

DROP FUNCTION IF EXISTS public.send_direct_message(uuid, text);
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_conversation uuid,
  p_body text,
  p_attachment_path text DEFAULT NULL,
  p_attachment_name text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL,
  p_attachment_size integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.conversations%ROWTYPE; v_me uuid := auth.uid(); v_other uuid; v_id uuid; v_text text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  v_text := LEFT(TRIM(COALESCE(p_body, '')), 2000);
  IF v_text = '' AND p_attachment_path IS NULL THEN RAISE EXCEPTION 'Message vide'; END IF;
  IF p_attachment_path IS NOT NULL AND p_attachment_path NOT LIKE v_me::text || '/%' THEN
    RAISE EXCEPTION 'Chemin de pièce jointe invalide';
  END IF;
  IF p_attachment_type IS NOT NULL AND p_attachment_type NOT IN ('image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'Format de fichier non accepté';
  END IF;
  IF p_attachment_size IS NOT NULL AND (p_attachment_size <= 0 OR p_attachment_size > 5242880) THEN
    RAISE EXCEPTION 'La capture dépasse 5 Mo';
  END IF;
  SELECT * INTO c FROM public.conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.user_low, c.user_high) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_me AND is_banned) THEN
    RAISE EXCEPTION 'Compte suspendu : envoi impossible';
  END IF;
  v_other := CASE WHEN v_me = c.user_low THEN c.user_high ELSE c.user_low END;
  INSERT INTO public.direct_messages (
    conversation_id, sender_id, body, attachment_path, attachment_name, attachment_type, attachment_size
  ) VALUES (
    p_conversation, v_me, v_text, p_attachment_path, p_attachment_name, p_attachment_type, p_attachment_size
  ) RETURNING id INTO v_id;
  UPDATE public.conversations SET last_message_at = now(),
    last_message_preview = CASE WHEN v_text <> '' THEN LEFT(v_text, 120) ELSE '📷 Capture envoyée' END
    WHERE id = p_conversation;
  PERFORM public._notify(v_other, 'message_received', 'Nouveau message',
    CASE WHEN v_text <> '' THEN LEFT(v_text, 120) ELSE 'Une capture a été envoyée.' END,
    '/messages?c=' || p_conversation);
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid,text,text,text,text,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.send_direct_message(uuid,text,text,text,text,integer) FROM anon;

CREATE POLICY "chat_evidence_upload_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
  AND COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

CREATE POLICY "chat_evidence_read_participants"
ON storage.objects FOR SELECT TO authenticated
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

CREATE POLICY "chat_evidence_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-evidence' AND owner_id = auth.uid()::text);