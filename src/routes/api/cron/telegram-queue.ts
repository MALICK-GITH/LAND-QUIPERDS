import { createFileRoute } from "@tanstack/react-router";

import { telegramQueueEndpoint } from "@/lib/telegram-queue.server";

export const Route = createFileRoute("/api/cron/telegram-queue")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return telegramQueueEndpoint(supabaseAdmin);
      },
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return telegramQueueEndpoint(supabaseAdmin);
      },
    },
  },
});
