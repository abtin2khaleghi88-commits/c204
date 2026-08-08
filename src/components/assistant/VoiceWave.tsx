/**
 * Ses dalgasi animasyonu.
 * `levels` -> playAudioSource'un AnalyserNode'undan gelen GERCEK genlik verisi
 * (0..1 arasi bant degerleri). Sabit dongu yok: ses yukseldikce dalga buyur.
 */
export function VoiceWave({
  active,
  label,
  levels,
}: {
  active: boolean;
  label?: string;
  levels?: number[];
}) {
  const bars = levels && levels.length > 0 ? levels : new Array(9).fill(0);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 items-end gap-[3px]">
        {bars.map((level, i) => (
          <span
            key={i}
            className="w-[3px] origin-bottom rounded-full bg-primary transition-[height,opacity] duration-75 ease-out"
            style={{
              height: `${active ? Math.max(8, Math.round(level * 32)) : 8}px`,
              opacity: active ? 0.55 + level * 0.45 : 0.4,
            }}
          />
        ))}
      </div>
      {label ? <span className="text-xs font-medium text-primary/80">{label}</span> : null}
    </div>
  );
}

/** Asistan avatari - konusan sesin genligine gore parildar. */
export function AssistantOrb({
  speaking,
  level = 0,
}: {
  speaking: boolean;
  level?: number;
}) {
  return (
    <div className="relative h-9 w-9 shrink-0">
      {speaking && (
        <span
          className="absolute inset-0 rounded-full bg-primary/40 blur-md transition-transform duration-75 ease-out"
          style={{ transform: `scale(${1 + level * 0.9})`, opacity: 0.35 + level * 0.65 }}
        />
      )}
      <span className="gradient-hero relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold tracking-wide text-primary-foreground">
        AI
      </span>
    </div>
  );
}
