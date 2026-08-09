import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/s2c";

/** Récupère un dictionnaire id -> profil pour une liste d'identifiants. */
export async function fetchProfileMap(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return {} as Record<string, Profile>;
  const { data } = await supabase.from("profiles").select("*").in("id", unique);
  const map: Record<string, Profile> = {};
  for (const p of data ?? []) map[p.id] = p as Profile;
  return map;
}