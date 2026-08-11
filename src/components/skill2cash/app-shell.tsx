import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Shield,
  Swords,
  Target,
  Trophy,
  User as UserIcon,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useNotifications } from "@/hooks/use-s2c";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { clearLastAuthRoute, setLastAuthRoute } from "@/lib/resume-route";
import { fcfa, relativeFr } from "@/lib/s2c";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const NAV = [
  { to: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/joueurs", label: "Joueurs", icon: Target },
  { to: "/defis", label: "Défis", icon: Swords },
  { to: "/duels", label: "Duels", icon: Trophy },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/portefeuille", label: "Portefeuille", icon: WalletIcon },
  { to: "/classement", label: "Classement", icon: Trophy },
  { to: "/assistant", label: "Assistant IA", icon: Bot },
  { to: "/profil", label: "Profil", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, wallet, isAdmin } = useMe();
  const notifications = useNotifications();
  const push = usePushNotifications(user?.id, () => void notifications.refetch());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLastAuthRoute(pathname);
  }, [pathname]);

  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearLastAuthRoute();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function markAllRead() {
    const ids = (notifications.data ?? []).filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    void notifications.refetch();
  }

  const links = isAdmin
    ? [...NAV, { to: "/admin", label: "Administration", icon: Shield } as const]
    : NAV;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/tableau-de-bord" className="shrink-0">
            <Logo compact />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 font-display text-[11px] font-bold tracking-wider uppercase transition-colors",
                    active
                      ? "text-glow border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden border border-accent/40 bg-accent/10 px-3 py-1.5 text-right clip-corner sm:block">
              <span className="block font-mono text-[9px] tracking-widest text-muted-foreground">
                SOLDE
              </span>
              <span className="text-glow-accent block font-display text-sm font-bold text-accent">
                {fcfa(wallet?.balance_available)}
              </span>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="font-display text-xs font-bold tracking-wider uppercase">
                    Notifications
                  </span>
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Tout marquer lu
                  </button>
                </div>
                {push.permission !== "granted" && push.permission !== "unsupported" && (
                  <button
                    onClick={() => void push.enable()}
                    className="block w-full border-b border-border/60 bg-primary/10 px-3 py-2 text-left text-[11px] font-semibold text-primary hover:bg-primary/20"
                  >
                    🔔 Activer les alertes système (messages, défis, duels) même hors de l'onglet
                  </button>
                )}
                <div className="max-h-80 overflow-y-auto">
                  {(notifications.data ?? []).length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Aucune notification.
                    </p>
                  )}
                  {(notifications.data ?? []).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "border-b border-border/50 px-3 py-2 last:border-0",
                        !n.is_read && "bg-primary/5",
                      )}
                    >
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {relativeFr(n.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={signOut} title="Se déconnecter">
              <LogOut className="size-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="grid grid-cols-2 gap-1 border-t border-border bg-surface p-3 lg:hidden">
            {links.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 border border-border/60 px-3 py-2 text-sm font-semibold clip-corner"
              >
                <item.icon className="size-4 text-primary" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {profile?.is_banned && (
          <div className="mb-6 border border-destructive/60 bg-destructive/10 p-4 clip-corner">
            <p className="font-display font-bold text-destructive">Compte suspendu</p>
            <p className="text-sm text-muted-foreground">
              Vous ne pouvez plus lancer ni accepter de duels. Contactez l'administration.
            </p>
          </div>
        )}
        {children}
      </main>

      <footer className="border-t border-border/60 py-6 text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        SKILL2CASH © {new Date().getFullYear()} — NO SKILL. NO CASH.
      </footer>
    </div>
  );
}
