-- Script pour corriger les politiques RLS du bucket chat-evidence
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Supprimer l'ancienne politique trop restrictive
DROP POLICY IF EXISTS "Users can view their own chat evidence" ON storage.objects;

-- 2. Créer la nouvelle politique qui permet aux participants de voir les fichiers
CREATE POLICY "Users can view chat evidence in their conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-evidence'
  AND (
    -- L'utilisateur peut voir ses propres fichiers
    auth.uid()::text = (storage.foldername(name))[1]
    -- OU l'utilisateur peut voir les fichiers des conversations auxquelles il participe
    OR EXISTS (
      SELECT 1 FROM public.direct_messages dm
      JOIN public.conversations c ON dm.conversation_id = c.id
      WHERE dm.attachment_path = name
      AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  )
);

-- Vérification
SELECT 
    'Politique RLS chat-evidence corrigée' as status;
