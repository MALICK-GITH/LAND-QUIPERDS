export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-9 items-center justify-center border border-primary/60 bg-primary/10 clip-corner">
        <img
          src="/skill2cash-mark.png"
          alt=""
          aria-hidden="true"
          className="size-6 select-none"
          draggable={false}
        />
      </span>
      <span className="leading-none">
        <span className="text-glow block font-display text-lg font-black tracking-widest text-primary">
          SKILL<span className="text-accent">2</span>CASH
        </span>
        {!compact && (
          <span className="block font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
            NO SKILL. NO CASH.
          </span>
        )}
      </span>
    </div>
  );
}
