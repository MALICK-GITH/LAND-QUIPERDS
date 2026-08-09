-- Script pour supprimer toutes les versions de la fonction _notify
-- Exécuter ce script en premier avant telegram-notifications.sql

DROP FUNCTION IF EXISTS public._notify CASCADE;
DROP FUNCTION IF EXISTS public._notify(uuid,text,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS public._notify(uuid,text,text,text) CASCADE;

SELECT 'Fonction _notify supprimee' as status;
