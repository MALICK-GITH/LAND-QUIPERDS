import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";

import { EmptyState, PageTitle, StatusChip } from "@/components/skill2cash/ui-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/profiles";
import { DUEL_STATUS_LABELS, dateFr, fcfa, type Duel } from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/duels/")({
  head: () => ({
    meta: [
      { title: "Duels — SKILL2CASH" },
      {
        name: "description",
        content: "Tes duels eFootball en cours et terminés, avec votes de consensus.",
      },
      { property: "og:title", content: "Duels — SKILL2CASH" },
      { property: "og:description", content: "Duels en cours, votes et historique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DuelsPage,
});

function DuelsPage() {
  const { user } = useMe();
  const qc = useQueryClient();

  const duels = useQuery({
    queryKey: ["duels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duels")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as Duel[];
      const profiles = await fetchProfileMap(rows.flatMap((d) => [d.player1_id, d.player2_id]));
      return { rows, profiles };
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("duels-list-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => {
        void qc.invalidateQueries({ queryKey: ["duels"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc, user]);

  const rows = duels.data?.rows ?? [];
  const profiles = duels.data?.profiles ?? {};
  const open = rows.filter((d) => ["active", "waiting_votes", "dispute"].includes(d.status));
  const done = rows.filter((d) => ["finished", "cancelled"].includes(d.status));

  function Row({ d }: { d: Duel }) {
    const opponentId = d.player1_id === user?.id ? d.player2_id : d.player1_id;
    const opponent = profiles[opponentId];
    const result =
      d.status !== "finished"
        ? null
        : d.is_draw
          ? "Match nul"
          : d.winner_id === user?.id
            ? "Victoire"
            : "Défaite";
    return (
      <Link
        to="/duels/$id"
        params={{ id: d.id }}
        className="panel flex items-center justify-between gap-3 p-4 clip-corner transition-colors hover:border-primary/60"
      >
        <div>
          <p className="font-display text-base font-bold">{fcfa(d.amount)}</p>
          <p className="text-sm text-foreground">vs {opponent?.username ?? "joueur"}</p>
          <p className="text-xs text-muted-foreground">
            {dateFr(d.created_at)}
            {result ? ` · ${result}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip status={d.status} label={DUEL_STATUS_LABELS[d.status]} />
          <ArrowRight className="size-4 text-muted-foreground" />
        </div>
      </Link>
    );
  }

  return (
    <div>
      <PageTitle title="Duels" subtitle="Duels en cours, votes de consensus et historique." />
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">En cours ({open.length})</TabsTrigger>
          <TabsTrigger value="done">Historique ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4 space-y-2">
          {open.length ? (
            open.map((d) => <Row key={d.id} d={d} />)
          ) : (
            <EmptyState text="Aucun duel en cours." />
          )}
        </TabsContent>
        <TabsContent value="done" className="mt-4 space-y-2">
          {done.length ? (
            done.map((d) => <Row key={d.id} d={d} />)
          ) : (
            <EmptyState text="Aucun duel terminé." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}