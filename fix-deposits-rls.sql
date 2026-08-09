-- Script pour ajouter les politiques RLS manquantes pour les administrateurs
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Supprimer la politique existante deposits_insert_own car elle est trop restrictive
DROP POLICY IF EXISTS deposits_insert_own ON public.deposits;

-- 2. Créer une politique pour permettre aux utilisateurs d'insérer leurs propres dépôts
CREATE POLICY "Users can insert own deposits"
ON public.deposits FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. Créer une politique pour permettre aux utilisateurs de voir leurs propres dépôts
CREATE POLICY "Users can view own deposits"
ON public.deposits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. Créer une politique pour permettre aux administrateurs de voir tous les dépôts en attente
CREATE POLICY "Admins can view all pending deposits"
ON public.deposits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  AND status = 'pending'
);

-- 5. Créer une politique pour permettre aux administrateurs de mettre à jour les dépôts
CREATE POLICY "Admins can update deposits"
ON public.deposits FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 6. Vérification des politiques créées
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'deposits'
ORDER BY policyname;
