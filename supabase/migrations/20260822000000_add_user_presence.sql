-- Add user presence tracking fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Create index for online users
CREATE INDEX IF NOT EXISTS idx_profiles_online 
ON public.profiles (is_online, last_seen_at DESC) 
WHERE is_online = true;

-- Create function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_activity_at = now();
  NEW.last_seen_at = now();
  NEW.is_online = true;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update presence on profile update
DROP TRIGGER IF EXISTS profiles_update_presence ON public.profiles;
CREATE TRIGGER profiles_update_presence
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_presence();

-- Create function to mark user as offline (called by client on logout/inactivity)
CREATE OR REPLACE FUNCTION public.mark_user_offline(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET is_online = false,
      last_seen_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Create function to mark user as online (called by client on login/activity)
CREATE OR REPLACE FUNCTION public.mark_user_online(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET is_online = true,
      last_activity_at = now(),
      last_seen_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.mark_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_user_online(uuid) TO authenticated;
