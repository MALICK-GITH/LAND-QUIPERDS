import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";

import { EmptyState, PageTitle, StatusChip } from "@/components/skill2cash/ui-bits";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fcfa, type Profile } from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/classement")({
  head: () => ({
    meta: [
      { title: "Classement — SKILL2CASH" },
      {
        name: "description",
        content: "Le classement des meilleurs joueurs eFootball par gains cumulés et victoires.",
      },
      { property: "og:title", content: "Classement — SKILL2CASH" },
      { property: "og:description", content: "Top joueurs par gains et victoires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = useMe();

  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_banned", false)
        .order("total_earnings", { ascending: false })
        .order("wins", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rows = board.data ?? [];

  return (
    <div>
      <PageTitle title="Classement" subtitle="Les joueurs les plus rentables de l'arène." />
      {rows.length ? (
        <div className="panel divide-y divide-border/50 clip-corner">
          {rows.map((p, i) => {
            const played = p.wins + p.losses + p.draws;
            return (
              <div
                key={p.id}
                className={
                  p.id === user?.id
                    ? "flex items-center gap-4 bg-primary/10 px-4 py-3"
                    : "flex items-center gap-4 px-4 py-3"
                }
              >
                <span className="w-8 font-display text-lg font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {i === 0 ? <Crown className="size-4 text-accent" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-primary">
                    {p.username}
                    {p.badge ? (
                      <span className="ml-2 font-mono text-[10px] text-neon">{p.badge}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.wins}V · {p.draws}N · {p.losses}D
                    {played ? ` · ${Math.round((p.wins / played) * 100)}%` : ""} · série{" "}
                    {p.current_streak}
                  </p>
                </div>
                <StatusChip status="active" label={p.level} />
                <p className="font-display text-sm font-bold text-accent">
                  {fcfa(p.total_earnings)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState text={board.isLoading ? "Chargement…" : "Classement vide."} />
      )}
    </div>
  );
}