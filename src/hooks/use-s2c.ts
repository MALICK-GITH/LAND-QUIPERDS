import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Profile, Wallet } from "@/lib/s2c";

export function useSession() {
  const query = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data.session?.user ?? null;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return { user: (query.data ?? null) as User | null, loading: query.isLoading };
}

export function useMe() {
  const { user, loading } = useSession();

  const query = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, walletRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      return {
        profile: (profileRes.data ?? null) as Profile | null,
        wallet: (walletRes.data ?? null) as Wallet | null,
        isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  return {
    user,
    loading: loading || query.isLoading,
    profile: query.data?.profile ?? null,
    wallet: query.data?.wallet ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    refetch: query.refetch,
  };
}

export function useNotifications() {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channelName = `notif-stream-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        void query.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return query;
}
