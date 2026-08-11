import { tgCall } from "./telegram.server";

export async function getBotUsername(): Promise<{ username: string | null }> {
  try {
    const me = await tgCall<{ username?: string }>("getMe", {});
    return { username: me?.username ?? null };
  } catch (error) {
    console.warn("[Telegram] Impossible de récupérer le robot officiel:", error);
    return { username: null };
  }
}
