// @ts-nocheck - Server-side only file using Node.js crypto module
import { tgSend } from "./telegram.server";

/** Traite la file d'attente des notifications Telegram */
export async function processTelegramQueue(supabaseAdmin: any) {
  const { data: pending } = await supabaseAdmin
    .from("telegram_notification_queue")
    .select("id, user_id, title, body, link, retry_count")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (!pending || pending.length === 0) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const notification of pending) {
    try {
      // Récupérer le chat_id Telegram de l'utilisateur
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", notification.user_id)
        .maybeSingle();

      if (!profile?.telegram_chat_id) {
        // Marquer comme envoyé si l'utilisateur n'a pas de Telegram lié
        await supabaseAdmin
          .from("telegram_notification_queue")
          .update({ sent_at: new Date().toISOString(), error_message: "No Telegram linked" })
          .eq("id", notification.id);
        processed++;
        continue;
      }

      // Envoyer la notification
      const result = await tgSend(profile.telegram_chat_id, notification.title, notification.link);

      if (result) {
        await supabaseAdmin
          .from("telegram_notification_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", notification.id);
        processed++;
      } else {
        // Incrémenter le compteur de retry
        const newRetryCount = (notification.retry_count || 0) + 1;
        if (newRetryCount >= 3) {
          // Marquer comme erreur permanente après 3 essais
          await supabaseAdmin
            .from("telegram_notification_queue")
            .update({ 
              sent_at: new Date().toISOString(), 
              error_message: "Max retries exceeded",
              retry_count: newRetryCount
            })
            .eq("id", notification.id);
        } else {
          await supabaseAdmin
            .from("telegram_notification_queue")
            .update({ retry_count: newRetryCount })
            .eq("id", notification.id);
        }
        errors++;
      }
    } catch (error) {
      console.error("Error processing Telegram notification:", error);
      errors++;
    }
  }

  return { processed, errors };
}

/** Endpoint pour le traitement de la file d'attente (à appeler via cron job) */
export async function telegramQueueEndpoint(supabaseAdmin: any) {
  const result = await processTelegramQueue(supabaseAdmin);
  return Response.json({
    success: true,
    processed: result.processed,
    errors: result.errors,
  });
}
