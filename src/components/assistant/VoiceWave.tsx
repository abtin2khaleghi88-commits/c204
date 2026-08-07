/** AI konusurken gorunen ses dalgasi animasyonu. */
export function VoiceWave({ active, label }: { active: boolean; label?: string }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 items-end gap-[3px]">
        {bars.map((i) => (
          <span
            key={i}
            className={
              "w-[3px] origin-bottom rounded-full bg-primary " +
              (active ? "animate-wave-bar h-8" : "h-2 opacity-40")
            }
            style={active ? { animationDelay: `${i * 90}ms` } : undefined}
          />
        ))}
      </div>
      {label ? <span className="text-xs font-medium text-primary/80">{label}</span> : null}
    </div>
  );
}

/** Asistan avatari - konusurken parildar. */
export function AssistantOrb({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative h-9 w-9 shrink-0">
      {speaking && (
        <span className="animate-soft-pulse absolute inset-0 rounded-full bg-primary/40 blur-md" />
      )}
      <span className="gradient-hero relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold tracking-wide text-primary-foreground">
        AI
      </span>
    </div>
  );
}
