import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-glow font-display text-3xl font-bold tracking-tight text-primary">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "neon" | "danger";
}) {
  const tones = {
    default: "text-foreground",
    accent: "text-accent text-glow-accent",
    neon: "text-neon",
    danger: "text-destructive",
  } as const;
  return (
    <div className="panel p-4 clip-corner">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-2 font-display text-2xl font-bold", tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const TONE_MAP: Record<string, string> = {
  pending: "border-warning/50 bg-warning/10 text-warning",
  counter_offer: "border-warning/50 bg-warning/10 text-warning",
  waiting_votes: "border-warning/50 bg-warning/10 text-warning",
  active: "border-primary/50 bg-primary/10 text-primary",
  accepted: "border-primary/50 bg-primary/10 text-primary",
  approved: "border-accent/50 bg-accent/10 text-accent",
  finished: "border-accent/50 bg-accent/10 text-accent",
  completed: "border-accent/50 bg-accent/10 text-accent",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
  declined: "border-destructive/50 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted/20 text-muted-foreground",
  expired: "border-border bg-muted/20 text-muted-foreground",
  dispute: "border-neon/50 bg-neon/10 text-neon",
};

export function StatusChip({ status, label }: { status: string; label?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase",
        TONE_MAP[status] ?? "border-border bg-muted/20 text-muted-foreground",
      )}
    >
      {label ?? status}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="panel p-10 text-center text-sm text-muted-foreground clip-corner">{text}</div>
  );
}