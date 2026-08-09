-- Script pour verifier les depots et diagnostiquer pourquoi ils ne s'affichent pas dans l'admin
-- Executer ce script dans l'editeur SQL Supabase

-- 1. Verifier tous les depots recents
SELECT 
    d.id,
    d.user_id,
    d.amount,
    d.method,
    d.status,
    d.reference,
    d.created_at,
    p.username,
    u.email
FROM public.deposits d
LEFT JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN auth.users u ON u.id = d.user_id
ORDER BY d.created_at DESC
LIMIT 20;

-- 2. Verifier specifiquement les depots en attente (ce que l'admin devrait voir)
SELECT 
    d.id,
    d.user_id,
    d.amount,
    d.method,
    d.status,
    d.reference,
    d.created_at,
    p.username,
    u.email
FROM public.deposits d
LEFT JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN auth.users u ON u.id = d.user_id
WHERE d.status = 'pending'
ORDER BY d.created_at ASC;

-- 3. Verifier les differents statuts de depots
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM public.deposits
GROUP BY status
ORDER BY status;

-- 4. Verifier si la table deposits existe et sa structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'deposits'
ORDER BY ordinal_position;

-- 5. Verifier les politiques RLS sur la table deposits
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'deposits';
