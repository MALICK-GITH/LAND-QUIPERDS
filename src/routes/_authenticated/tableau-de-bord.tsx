import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Swords, Target, Wallet as WalletIcon } from "lucide-react";

import { EmptyState, PageTitle, StatCard, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { useMe, useNotifications } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import {
  CHALLENGE_STATUS_LABELS,
  DUEL_STATUS_LABELS,
  dateFr,
  fcfa,
  relativeFr,
  TX_LABELS,
} from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — SKILL2CASH" },
      {
        name: "description",
        content: "Vue d'ensemble de ton solde, tes duels en cours et tes défis reçus sur SKILL2CASH.",
      },
      { property: "og:title", content: "Tableau de bord — SKILL2CASH" },
      { property: "og:description", content: "Solde, duels en cours et défis reçus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, wallet } = useMe();
  const notifications = useNotifications();

  const activity = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [duels, challenges, txs] = await Promise.all([
        supabase
          .from("duels")
          .select("*")
          .in("status", ["active", "waiting_votes", "dispute"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("challenges")
          .select("*")
          .in("status", ["pending", "counter_offer"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      return {
        duels: duels.data ?? [],
        challenges: challenges.data ?? [],
        txs: txs.data ?? [],
      };
    },
  });

  const played = (profile?.wins ?? 0) + (profile?.losses ?? 0) + (profile?.draws ?? 0);
  const winRate = played ? Math.round(((profile?.wins ?? 0) / played) * 100) : 0;

  return (
    <div>
      <PageTitle
        title={`Salut ${profile?.username ?? "joueur"}`}
        subtitle="Ton arène, tes règles. Voici l'état de tes finances et de tes duels."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/portefeuille">
                <WalletIcon className="size-4" /> Recharger
              </Link>
            </Button>
            <Button asChild>
              <Link to="/joueurs">
                <Target className="size-4" /> Lancer un défi
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Solde disponible" value={fcfa(wallet?.balance_available)} tone="accent" />
        <StatCard
          label="Fonds bloqués"
          value={fcfa(wallet?.balance_locked)}
          hint="Mises engagées dans des duels"
          tone="neon"
        />
        <StatCard
          label="Bilan"
          value={`${profile?.wins ?? 0}V · ${profile?.draws ?? 0}N · ${profile?.losses ?? 0}D`}
          hint={`${winRate}% de victoires sur ${played} duels`}
        />
        <StatCard
          label="Gains cumulés"
          value={fcfa(profile?.total_earnings)}
          hint={`Série en cours : ${profile?.current_streak ?? 0}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
            Duels en cours
          </h2>
          {activity.data?.duels.length ? (
            <div className="space-y-2">
              {activity.data.duels.map((d) => (
                <Link
                  key={d.id}
                  to="/duels/$id"
                  params={{ id: d.id }}
                  className="panel flex items-center justify-between gap-3 p-4 clip-corner transition-colors hover:border-primary/60"
                >
                  <div>
                    <p className="font-display text-sm font-bold">{fcfa(d.amount)}</p>
                    <p className="text-xs text-muted-foreground">{dateFr(d.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusChip status={d.status} label={DUEL_STATUS_LABELS[d.status]} />
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="Aucun duel en cours. Va chercher un adversaire !" />
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
            Défis actifs
          </h2>
          {activity.data?.challenges.length ? (
            <div className="space-y-2">
              {activity.data.challenges.map((c) => (
                <div key={c.id} className="panel flex items-center justify-between p-4 clip-corner">
                  <div>
                    <p className="font-display text-sm font-bold">
                      {fcfa(c.accepted_amount ?? c.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.challenger_id === user?.id ? "Envoyé" : "Reçu"} · {dateFr(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusChip status={c.status} label={CHALLENGE_STATUS_LABELS[c.status]} />
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/defis">
                        <Swords className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Aucun défi en attente." />
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
          Dernières opérations
        </h2>
        {activity.data?.txs.length ? (
          <div className="panel divide-y divide-border/50 clip-corner">
            {activity.data.txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{TX_LABELS[t.type] ?? t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.description ?? "—"} · {dateFr(t.created_at)}
                  </p>
                </div>
                <p
                  className={
                    Number(t.amount) >= 0
                      ? "font-display text-sm font-bold text-accent"
                      : "font-display text-sm font-bold text-destructive"
                  }
                >
                  {Number(t.amount) >= 0 ? "+" : ""}
                  {fcfa(t.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Aucune opération pour l'instant." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
          Historique des notifications
        </h2>
        {notifications.data?.length ? (
          <div className="panel divide-y divide-border/50 clip-corner">
            {notifications.data.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p
                    className={
                      n.is_read ? "text-sm font-semibold" : "text-sm font-bold text-primary"
                    }
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {dateFr(n.created_at)} · {relativeFr(n.created_at)}
                  </p>
                </div>
                {n.link && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={n.link}>
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Aucune notification pour l'instant." />
        )}
      </section>
    </div>
  );
}