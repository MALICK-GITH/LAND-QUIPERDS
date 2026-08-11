-- Script de réparation des politiques RLS manquantes
-- Exécuter ce script dans l'éditeur SQL Supabase
-- Ce script corrige les problèmes avec les défis et le système de chat

-- ==========================================
-- 1. CORRECTION DES POLITIQUES CHALLENGES
-- ==========================================

-- Politique UPDATE pour permettre l'annulation et la réponse aux défis
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'challenges_update_involved' AND tablename = 'challenges') THEN
        CREATE POLICY "challenges_update_involved" ON public.challenges FOR UPDATE TO authenticated
          USING (challenger_id = auth.uid() OR challenged_id = auth.uid())
          WITH CHECK (challenger_id = auth.uid() OR challenged_id = auth.uid());
    END IF;
END $$;

-- ==========================================
-- 2. CORRECTION DES POLITIQUES CONVERSATIONS
-- ==========================================

-- Politique INSERT pour permettre la création de conversations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_insert_member' AND tablename = 'conversations') THEN
        CREATE POLICY "conversations_insert_member" ON public.conversations FOR INSERT TO authenticated
          WITH CHECK (user_low = auth.uid() OR user_high = auth.uid());
    END IF;
END $$;

-- Politique UPDATE pour permettre la mise à jour (last_message_at, etc.)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_update_member' AND tablename = 'conversations') THEN
        CREATE POLICY "conversations_update_member" ON public.conversations FOR UPDATE TO authenticated
          USING (user_low = auth.uid() OR user_high = auth.uid())
          WITH CHECK (user_low = auth.uid() OR user_high = auth.uid());
    END IF;
END $$;

-- ==========================================
-- 3. CORRECTION DES POLITIQUES DIRECT_MESSAGES
-- ==========================================

-- Politique INSERT pour permettre l'envoi de messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dm_insert_member' AND tablename = 'direct_messages') THEN
        CREATE POLICY "dm_insert_member" ON public.direct_messages FOR INSERT TO authenticated
          WITH CHECK (
            sender_id = auth.uid()
            AND EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id = direct_messages.conversation_id
                AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
            )
          );
    END IF;
END $$;

-- Politique UPDATE pour permettre le marquage comme lu
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dm_update_member' AND tablename = 'direct_messages') THEN
        CREATE POLICY "dm_update_member" ON public.direct_messages FOR UPDATE TO authenticated
          USING (
            sender_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id = direct_messages.conversation_id
                AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
            )
          )
          WITH CHECK (
            sender_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id = direct_messages.conversation_id
                AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
            )
          );
    END IF;
END $$;

-- ==========================================
-- 4. VÉRIFICATION
-- ==========================================

SELECT 
    'Politiques RLS manquantes ajoutées avec succès' as status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'challenges') as challenges_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversations') as conversations_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'direct_messages') as direct_messages_policies;
