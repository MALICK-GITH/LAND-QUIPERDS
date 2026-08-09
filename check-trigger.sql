-- Script pour vérifier l'état du trigger handle_new_user
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Vérifier si la fonction handle_new_user existe
SELECT 
    routine_name as function_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- 2. Vérifier si le trigger existe sur auth.users
SELECT 
    trigger_name,
    event_manipulation as event,
    event_object_table as table_name,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'users'
AND event_object_schema = 'auth';

-- 3. Vérifier les utilisateurs créés récemment sans profil
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.id as profile_id,
    p.username,
    w.id as wallet_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;

-- 4. Vérifier les rôles admin
SELECT 
    ur.user_id,
    ur.role,
    p.username,
    u.email,
    p.badge,
    p.level
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY p.created_at;
