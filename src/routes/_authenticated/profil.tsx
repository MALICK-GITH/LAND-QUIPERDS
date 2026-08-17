import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Volume2, VolumeX, Play, RotateCcw } from "lucide-react";

import { EmptyState, PageTitle, StatCard, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-s2c";
import { useSounds } from "@/hooks/use-sounds";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramBot } from "@/lib/telegram.functions";
import {
  REQUEST_STATUS_LABELS,
  dateFr,
  errMessage,
  fcfa,
  type UsernameChangeRequest,
} from "@/lib/s2c";
import { SOUND_LABELS, PRESET_LABELS, type SoundType, type SoundPreset } from "@/lib/sounds";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — SKILL2CASH" },
      {
        name: "description",
        content: "Tes informations de joueur, tes statistiques et tes demandes de changement de pseudo.",
      },
      { property: "og:title", content: "Mon profil — SKILL2CASH" },
      { property: "og:description", content: "Informations, statistiques et réputation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refetch } = useMe();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [reason, setReason] = useState("");
  const [linkCode, setLinkCode] = useState<string | null>(null);
  
  const sounds = useSounds();

  const fetchBot = useServerFn(getTelegramBot);
  const bot = useQuery({ queryKey: ["telegram-bot"], queryFn: () => fetchBot() });
  const botUsername = bot.data?.username ?? null;
  const telegramLinked = !!profile?.telegram_chat_id;

  const genCode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_telegram_link_code");
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (code) => {
      setLinkCode(code);
      toast.success("Code généré — valable 15 minutes.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const unlink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("unlink_telegram");
      if (error) throw error;
    },
    onSuccess: () => {
      setLinkCode(null);
      toast.success("Telegram déconnecté.");
      void refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const requests = useQuery({
    queryKey: ["username-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("username_change_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as UsernameChangeRequest[];
    },
  });

  const saveIdentity = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: (firstName ?? profile?.first_name ?? "").trim().slice(0, 60) || null,
          last_name: (lastName ?? profile?.last_name ?? "").trim().slice(0, 60) || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour.");
      void refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const askUsername = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_username_change", {
        p_new_username: newUsername.trim().slice(0, 30),
        p_reason: reason.trim().slice(0, 300),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée à l'administration.");
      setNewUsername("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["username-requests"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const played = (profile?.wins ?? 0) + (profile?.losses ?? 0) + (profile?.draws ?? 0);

  return (
    <div>
      <PageTitle
        title="Mon profil"
        subtitle={`${profile?.username ?? "—"} · ${profile?.country ?? "—"}`}
        action={<StatusChip status={profile?.status ?? "active"} label={profile?.level} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Duels joués" value={played} />
        <StatCard
          label="Bilan"
          value={`${profile?.wins ?? 0}V · ${profile?.draws ?? 0}N · ${profile?.losses ?? 0}D`}
        />
        <StatCard label="Gains cumulés" value={fcfa(profile?.total_earnings)} tone="accent" />
        <StatCard
          label="Réputation"
          value={`${profile?.reputation ?? 100}/100`}
          hint={`${profile?.reports_count ?? 0} signalement(s)`}
          tone={(profile?.reputation ?? 100) < 60 ? "danger" : "default"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel p-5 clip-corner">
          <h2 className="font-display text-sm font-bold tracking-widest uppercase">
            Informations personnelles
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Prénom</Label>
              <Input
                maxLength={60}
                value={firstName ?? profile?.first_name ?? ""}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label>Nom</Label>
              <Input
                maxLength={60}
                value={lastName ?? profile?.last_name ?? ""}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <Label>Pseudo eFootball</Label>
              <Input value={profile?.efootball_username ?? ""} disabled />
              <p className="mt-1 text-xs text-muted-foreground">
                Le pseudo est verrouillé : il sert de preuve d'identité dans le jeu.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={saveIdentity.isPending}
              onClick={() => saveIdentity.mutate()}
            >
              Enregistrer
            </Button>
          </div>
        </section>

        <section className="panel p-5 clip-corner">
          <h2 className="font-display text-sm font-bold tracking-widest uppercase">
            Changer de pseudo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Toute modification de pseudo passe par une validation administrateur.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Nouveau pseudo</Label>
              <Input
                maxLength={30}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explique pourquoi tu veux changer de pseudo."
              />
            </div>
            <Button
              className="w-full"
              variant="secondary"
              disabled={
                askUsername.isPending || newUsername.trim().length < 3 || reason.trim().length < 5
              }
              onClick={() => askUsername.mutate()}
            >
              Envoyer la demande
            </Button>
          </div>

          <div className="mt-5">
            {requests.data?.length ? (
              <div className="divide-y divide-border/50 border border-border/50">
                {requests.data.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">{r.new_username}</p>
                      <p className="text-xs text-muted-foreground">{dateFr(r.created_at)}</p>
                    </div>
                    <StatusChip status={r.status} label={REQUEST_STATUS_LABELS[r.status]} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Aucune demande de changement." />
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 panel p-5 clip-corner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold tracking-widest uppercase">
              Robot Telegram
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connecte ton compte au robot officiel : tu reçois défis, votes, résultats, litiges et
              mouvements de portefeuille directement dans Telegram, même hors du site.
            </p>
          </div>
          <StatusChip
            status={telegramLinked ? "approved" : "pending"}
            label={telegramLinked ? "Connecté" : "Non connecté"}
          />
        </div>

        {telegramLinked ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Compte lié
              {profile?.telegram_username ? (
                <span className="font-semibold text-primary"> @{profile.telegram_username}</span>
              ) : null}
              {profile?.telegram_linked_at ? (
                <span className="text-muted-foreground"> · depuis le {dateFr(profile.telegram_linked_at)}</span>
              ) : null}
            </p>
            <Button
              variant="destructive"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              Déconnecter Telegram
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Génère ton code de liaison ci-dessous.</li>
              <li>
                Ouvre le robot{" "}
                {botUsername ? (
                  <span className="font-semibold text-primary">@{botUsername}</span>
                ) : (
                  "SKILL2CASH"
                )}{" "}
                sur Telegram.
              </li>
              <li>
                Envoie <code className="text-accent">/lier TONCODE</code> — c'est tout.
              </li>
            </ol>

            {linkCode && (
              <div className="border border-accent/50 bg-accent/10 p-3 clip-corner">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  TON CODE (15 MIN)
                </p>
                <p className="text-glow-accent font-display text-2xl font-bold text-accent">
                  {linkCode}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={genCode.isPending} onClick={() => genCode.mutate()}>
                {linkCode ? "Générer un nouveau code" : "Connecter mon compte Telegram"}
              </Button>
              {botUsername && (
                <Button asChild variant="secondary">
                  <a
                    href={`https://t.me/${botUsername}?start=${linkCode ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir le robot Telegram
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 panel p-5 clip-corner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold tracking-widest uppercase">
              Sons de notification
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Personnalise les sons pour chaque type d'événement sur SKILL2CASH.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sounds.settings.enabled ? (
              <Volume2 className="size-4 text-primary" />
            ) : (
              <VolumeX className="size-4 text-muted-foreground" />
            )}
            <Switch
              checked={sounds.settings.enabled}
              onCheckedChange={sounds.setEnabled}
            />
          </div>
        </div>

        {sounds.settings.enabled && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>Preset de sons</Label>
                <Select
                  value={sounds.settings.preset}
                  onValueChange={(value) => sounds.setPreset(value as SoundPreset)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <Label>Volume ({sounds.settings.volume}%)</Label>
                <Slider
                  value={[sounds.settings.volume]}
                  onValueChange={([value]) => sounds.setVolume(value)}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={sounds.resetSettings}
                disabled={sounds.settings.preset === "classic" && sounds.settings.volume === 70}
              >
                <RotateCcw className="mr-2 size-4" />
                Réinitialiser
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(SOUND_LABELS).map(([type, label]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded border border-border/50 bg-surface/50 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sounds.settings.preset === "custom" && sounds.settings.customSounds[type as SoundType]
                        ? "Personnalisé"
                        : PRESET_LABELS[sounds.settings.preset]
                      }
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => sounds.previewSound(type as SoundType)}
                    title="Écouter"
                  >
                    <Play className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            {sounds.settings.preset === "custom" && (
              <div className="rounded border border-accent/50 bg-accent/10 p-3">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  MODE PERSONNALISÉ
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pour configurer des sons personnalisés, tu peux ajouter tes propres fichiers audio dans le dossier
                  <code className="mx-1 text-accent">public/sounds/custom/</code>
                  et les sélectionner ici.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}