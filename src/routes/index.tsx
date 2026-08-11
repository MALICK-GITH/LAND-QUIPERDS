import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coins, Gavel, MessageCircle, ShieldCheck, Swords, Vote, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/skill2cash/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/EyJCcsTNX2z2qEgqYMj9iR?s=cl&p=a&mlu=4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SKILL2CASH — Duels eFootball 1v1 en FCFA" },
      {
        name: "description",
        content:
          "Plateforme de duels eFootball 1v1 avec enjeux réels en FCFA. Mises bloquées, résultats validés par consensus, retraits Wave et MTN.",
      },
      { property: "og:title", content: "SKILL2CASH — Duels eFootball 1v1 en FCFA" },
      {
        property: "og:description",
        content:
          "Défie, joue, encaisse. Consensus de vote, commission transparente, paiement mobile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: Wallet,
    title: "1. Recharge",
    text: "Dépose via Wave ou MTN. La référence de transaction est vérifiée par un administrateur avant crédit.",
  },
  {
    icon: Swords,
    title: "2. Défie",
    text: "Choisis un adversaire et un enjeu. À l'acceptation, les deux mises sont bloquées automatiquement.",
  },
  {
    icon: Vote,
    title: "3. Vote",
    text: "Après le match, chacun vote Gagné / Nul / Perdu. Si les votes concordent, le duel est réglé instantanément.",
  },
  {
    icon: Coins,
    title: "4. Encaisse",
    text: "Le gagnant reçoit le pot moins la commission. Retrait sur ton numéro mobile money.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Session déjà ouverte (retour sur le site) : on renvoie directement dans l'app.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setSignedIn(true);
        void navigate({ to: "/tableau-de-bord", replace: true });
        return;
      }
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setSignedIn(true);
        void navigate({ to: "/tableau-de-bord", replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
          <Logo />
          {signedIn ? (
            <Button asChild>
              <Link to="/tableau-de-bord">Mon tableau de bord</Link>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button asChild variant="ghost">
                <Link to="/auth">Connexion</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Créer un compte</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <section className="grid-lines relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <p className="font-mono text-xs tracking-[0.4em] text-accent">EFOOTBALL · 1V1 · FCFA</p>
          <h1 className="text-glow mx-auto mt-6 max-w-3xl font-display text-5xl font-black tracking-tight text-primary sm:text-7xl">
            NO SKILL.
            <br />
            <span className="text-glow-accent text-accent">NO CASH.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            La plateforme de duels eFootball 1v1 avec de vrais enjeux. Mises sécurisées, résultats
            validés par consensus entre joueurs, arbitrage administrateur en cas de litige.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="pulse-ring">
              <Link to={signedIn ? "/tableau-de-bord" : "/auth"}>Entrer dans l'arène</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/classement">Voir le classement</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 size-4" />
                Groupe WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center font-display text-3xl font-bold">Comment ça marche</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <article key={s.title} className="panel p-6 clip-corner">
              <s.icon className="size-8 text-primary" />
              <h3 className="mt-4 font-display text-base font-bold tracking-wide">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
          <div className="flex gap-4">
            <ShieldCheck className="size-8 shrink-0 text-accent" />
            <div>
              <h3 className="font-display text-base font-bold">Mises sécurisées</h3>
              <p className="text-sm text-muted-foreground">
                Les fonds sont bloqués dès l'acceptation du défi et libérés uniquement au règlement.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Vote className="size-8 shrink-0 text-accent" />
            <div>
              <h3 className="font-display text-base font-bold">Consensus de vote</h3>
              <p className="text-sm text-muted-foreground">
                Plus de captures d'écran : les deux joueurs votent, le système règle
                automatiquement.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Gavel className="size-8 shrink-0 text-accent" />
            <div>
              <h3 className="font-display text-base font-bold">Arbitrage des litiges</h3>
              <p className="text-sm text-muted-foreground">
                Votes incohérents ? Les fonds restent bloqués jusqu'à la décision d'un
                administrateur.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 text-center font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
        SKILL2CASH © {new Date().getFullYear()} — JOUE RESPONSABLE. RÉSERVÉ AUX 18 ANS ET PLUS.
        <div className="mt-4">
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-display text-[11px] tracking-[0.2em] text-emerald-200 transition-colors hover:bg-emerald-500/20 hover:text-white"
          >
            <MessageCircle className="size-3.5" />
            Rejoindre le groupe WhatsApp
          </a>
        </div>
      </footer>
    </div>
  );
}
