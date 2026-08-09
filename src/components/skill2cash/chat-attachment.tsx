import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileImage } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateChatImage(file: File): string | null {
  if (!CHAT_IMAGE_TYPES.includes(file.type)) return "Format accepté : JPG, PNG ou WebP.";
  if (file.size > CHAT_IMAGE_MAX_BYTES) return "La capture ne doit pas dépasser 5 Mo.";
  return null;
}

export function attachmentPath(userId: string, file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

type ChatAttachmentProps = {
  path: string;
  name?: string | null;
  evidence?: boolean;
  className?: string;
};

export function ChatAttachment({ path, name, evidence, className }: ChatAttachmentProps) {
  const signedUrl = useQuery({
    queryKey: ["chat-attachment", path],
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-evidence").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  if (signedUrl.isLoading) {
    return <div className={cn("h-32 w-48 animate-pulse bg-muted/30", className)} />;
  }
  if (!signedUrl.data) {
    return <p className="text-xs text-destructive">Capture indisponible.</p>;
  }

  return (
    <a
      href={signedUrl.data}
      target="_blank"
      rel="noreferrer"
      className={cn("group relative mt-2 block max-w-sm overflow-hidden border border-border bg-muted/20", className)}
      aria-label={`Ouvrir ${name ?? "la capture"}`}
    >
      <img
        src={signedUrl.data}
        alt={name ? `Capture : ${name}` : "Capture envoyée dans le chat"}
        loading="lazy"
        className="max-h-72 w-full object-contain"
      />
      <span className="absolute right-2 bottom-2 flex items-center gap-1 bg-background/90 px-2 py-1 text-[10px] text-foreground">
        {evidence ? <FileImage className="size-3 text-neon" /> : <ExternalLink className="size-3" />}
        {evidence ? "Justificatif" : "Agrandir"}
      </span>
    </a>
  );
}