import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/skill2cash/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/s2c";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion & inscription — SKILL2CASH" },
      {
        name: "description",
        content:
          "Connecte-toi ou crée ton compte SKILL2CASH pour lancer des duels eFootball 1v1 avec enjeux en FCFA.",
      },
      { property: "og:title", content: "Connexion & inscription — SKILL2CASH" },
      {
        property: "og:description",
        content: "Accède à ton compte SKILL2CASH : portefeuille, défis et duels 1v1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/tableau-de-bord", replace: true });
    });
  }, [navigate]);

  // --- connexion ---
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function handleLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(errMessage(error));
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/tableau-de-bord", replace: true });
  }

  // --- inscription ---
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    firstName: "",
    lastName: "",
    country: "Cote d'Ivoire",
    level: "Amateur",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSignup(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (form.username.trim().length < 3) {
      toast.error("Le pseudo eFootball doit contenir au moins 3 caractères.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username: form.username.trim(),
          efootball_username: form.username.trim(),
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          country: form.country,
          level: form.level,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(errMessage(error));
      return;
    }
    if (!data.session) {
      toast.success("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.");
      return;
    }
    toast.success("Bienvenue dans l'arène !");
    navigate({ to: "/tableau-de-bord", replace: true });
  }

  async function handleGoogle(): Promise<void> {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Connexion Google impossible pour le moment.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/tableau-de-bord", replace: true });
  }

  return (
    <div className="grid-lines flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>

        <div className="panel panel-glow p-6 clip-corner">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Connexion…" : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="su-username">Pseudo eFootball exact</Label>
                  <Input
                    id="su-username"
                    required
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    placeholder="Ex : onexdelux1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attention : ce pseudo est verrouillé après l'inscription. Toute modification
                    nécessite l'accord d'un administrateur.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="su-first">Prénom</Label>
                    <Input
                      id="su-first"
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="su-last">Nom</Label>
                    <Input
                      id="su-last"
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="su-country">Pays</Label>
                    <Input
                      id="su-country"
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Niveau</Label>
                    <Select value={form.level} onValueChange={(v) => set("level", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Amateur">Amateur</SelectItem>
                        <SelectItem value="Pro">Pro</SelectItem>
                        <SelectItem value="Elite">Elite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-password">Mot de passe</Label>
                  <Input
                    id="su-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Création…" : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">OU</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continuer avec Google
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Réservé aux 18 ans et plus. Joue de manière responsable.
        </p>
      </div>
    </div>
  );
}