import { tgCall } from "./telegram.server";

export async function getBotUsername(): Promise<{ username: string | null }> {
  const me = await tgCall<{ username?: string }>("getMe", {});
  return { username: me?.username ?? null };
}