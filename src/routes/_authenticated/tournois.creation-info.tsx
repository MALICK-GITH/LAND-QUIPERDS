import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mail, Trophy } from "lucide-react";

import { PageTitle } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tournois/creation-info")({
  head: () => ({
    meta: [
      { title: "Création de tournois — SKILL2CASH" },
      {
        name: "description",
        content: "Informations sur la création de tournois sur SKILL2CASH.",
      },
      { property: "og:title", content: "Création de tournois — SKILL2CASH" },
      { property: "og:description", content: "Processus de création de tournois." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentCreationInfoPage,
});

function TournamentCreationInfoPage() {
  return (
    <div>
      <PageTitle
        title="Création de Tournois"
        subtitle="Processus et conditions pour organiser des tournois sur SKILL2CASH."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel p-6 clip-corner">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="size-8 text-accent" />
            <h3 className="font-display text-lg font-bold text-primary">
              Réservé aux Administrateurs
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            La création de tournois est actuellement réservée aux administrateurs de la plateforme
            pour garantir la qualité et la sécurité des événements.
          </p>
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>Validation des buy-ins et prize pools</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>Supervision des brackets et résultats</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>Gestion des litiges et problèmes</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-accent">•</span>
              <span>Distribution des prix aux gagnants</span>
            </p>
          </div>
        </div>

        <div className="panel p-6 clip-corner">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="size-8 text-primary" />
            <h3 className="font-display text-lg font-bold text-primary">
              Devenir Organisateur
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Si vous souhaitez organiser des tournois régulièrement, vous pouvez demander à devenir
            organisateur certifié.
          </p>
          <div className="space-y-3 text-sm">
            <div className="p-3 border border-border/60 bg-muted/20 rounded">
              <p className="font-semibold mb-1">Avantages :</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Création autonome de tournois</li>
                <li>• Commission réduite sur vos événements</li>
                <li>• Badge "Organisateur" visible</li>
                <li>• Support prioritaire</li>
              </ul>
            </div>
            <div className="p-3 border border-border/60 bg-muted/20 rounded">
              <p className="font-semibold mb-1">Conditions :</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Minimum 3 tournois organisés avec succès</li>
                <li>• Réputation minimum 80</li>
                <li>• Aucun litige non résolu</li>
                <li>• Validation par l'équipe SKILL2CASH</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 panel p-6 clip-corner">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="size-8 text-primary" />
          <h3 className="font-display text-lg font-bold text-primary">
            Contacter l'Équipe
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Pour proposer un tournoi ou demander le statut d'organisateur, contactez-nous directement.
        </p>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <span className="font-semibold">Email :</span>
            <span>support@skill2cash.com</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="font-semibold">WhatsApp :</span>
            <a
              href="https://chat.whatsapp.com/LFhxJLvRGcO0zkXBM4ndTF"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Groupe officiel SKILL2CASH
            </a>
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link to="/tournois">
              Retour aux tournois
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://chat.whatsapp.com/LFhxJLvRGcO0zkXBM4ndTF"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contacter sur WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}