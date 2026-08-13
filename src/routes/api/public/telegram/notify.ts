import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { safeEqual, tgSend } from "@/lib/telegram.server";

const bodySchema = z.object({ notification_id: z.string().uuid() });

export const Route = createFileRoute("/api/public/telegram/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_NOTIFY_SECRET"] ?? "";
        const provided = request.headers.get("x-notify-secret") ?? "";
        if (!secret || !safeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("notifications")
          .select("user_id, title, body, link")
          .eq("id", parsed.data.notification_id)
          .maybeSingle();
        const n = data as
          | { user_id: string | null; title: string; body: string | null; link: string | null }
          | null;
        if (!n?.user_id) return Response.json({ ok: true, skipped: true });

        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("telegram_chat_id")
          .eq("id", n.user_id)
          .maybeSingle();
        const chat = (prof as { telegram_chat_id: number | null } | null)?.telegram_chat_id;
        if (!chat) return Response.json({ ok: true, skipped: true });

        await tgSend(chat, `<b>${n.title}</b>${n.body ? `\n${n.body}` : ""}`, n.link);
        return Response.json({ ok: true });
      },
    },
  },
});