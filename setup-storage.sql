-- Script pour créer et configurer le bucket chat-evidence dans Supabase Storage
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Créer le bucket chat-evidence s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-evidence',
  'chat-evidence',
  false,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Créer les politiques RLS pour le bucket
-- Politique pour permettre aux utilisateurs authentifiés d'uploader
CREATE POLICY "Authenticated users can upload chat evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de voir leurs propres fichiers
CREATE POLICY "Users can view their own chat evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de supprimer leurs propres fichiers
CREATE POLICY "Users can delete their own chat evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Vérification
SELECT 
    'Bucket chat-evidence configuré' as status,
    (SELECT COUNT(*) FROM storage.buckets WHERE id = 'chat-evidence') as bucket_exists;
