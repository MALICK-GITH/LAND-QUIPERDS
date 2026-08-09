import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type NotifRow = {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
};

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

function currentPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

/** Enregistre le service worker de notifications (une seule fois). */
export async function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

async function showSystemNotification(n: NotifRow) {
  const payload = {
    type: "s2c-notify" as const,
    title: n.title,
    body: n.body ?? "",
    link: n.link ?? "/tableau-de-bord",
    tag: n.type + "-" + n.id,
  };

  const reg = (await navigator.serviceWorker?.getRegistration()) ?? (await registerNotificationWorker());
  if (reg?.active) {
    reg.active.postMessage(payload);
    return;
  }
  // Repli : notification directe depuis la page.
  try {
    new Notification(payload.title, { body: payload.body, icon: "/favicon.ico" });
  } catch {
    /* ignoré */
  }
}

/**
 * Notifications temps réel : toast dans l'app + notification système
 * (visible même quand l'onglet est en arrière-plan) dès qu'une ligne
 * `notifications` est insérée pour l'utilisateur connecté.
 */
export function usePushNotifications(userId: string | undefined, onNotify?: () => void) {
  const [permission, setPermission] = useState<PermissionState>("unsupported");

  useEffect(() => {
    setPermission(currentPermission());
    void registerNotificationWorker();
  }, []);

  async function enable() {
    if (!("Notification" in window)) {
      toast.error("Ton navigateur ne gère pas les notifications.");
      return;
    }
    await registerNotificationWorker();
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
    if (result === "granted") {
      toast.success("Notifications activées 🔔");
      void showSystemNotification({
        id: "welcome",
        user_id: userId ?? null,
        type: "test",
        title: "SKILL2CASH",
        body: "Les alertes sont actives : défis, messages, duels et paiements.",
        link: "/tableau-de-bord",
      });
    } else {
      toast.error("Notifications refusées. Autorise-les dans les réglages du navigateur.");
    }
  }

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`push-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotifRow;
          onNotify?.();
          toast(n.title, { description: n.body ?? undefined });
          if (currentPermission() === "granted" && document.visibilityState !== "visible") {
            void showSystemNotification(n);
          } else if (currentPermission() === "granted") {
            void showSystemNotification(n);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { permission, enable };
}