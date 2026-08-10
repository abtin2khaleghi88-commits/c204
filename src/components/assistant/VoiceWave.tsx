/**
 * C204 HUD ses görselleştirmeleri.
 * `levels` -> playAudioSource'un AnalyserNode'undan gelen GERCEK genlik verisi
 * (0..1 arasi bant degerleri). Sabit dongu yok: ses yukseldikce halka buyur.
 */

function peak(levels?: number[]): number {
  if (!levels || levels.length === 0) return 0;
  return Math.min(1, Math.max(...levels));
}

/**
 * Merkezi HUD halkasi: konusurken sesin genligine gore nabiz gibi atar,
 * bosta ise yavas "nefes alan" bir bekleme animasyonu gosterir.
 */
export function PulseRing({
  active,
  levels,
  size = 220,
  label,
}: {
  active: boolean;
  levels?: number[];
  size?: number;
  label?: string;
}) {
  const level = active ? peak(levels) : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Dis parlama */}
        <span
          className="absolute inset-0 rounded-full bg-primary/25 blur-2xl transition-[transform,opacity] duration-100 ease-out"
          style={{
            transform: `scale(${active ? 0.85 + level * 0.5 : 0.8})`,
            opacity: active ? 0.35 + level * 0.5 : 0.25,
          }}
        />

        {/* Yavas donen dis HUD halkalari */}
        <span className="animate-hud-spin absolute inset-0 rounded-full border border-primary/25 border-t-primary/70" />
        <span className="animate-hud-spin-reverse absolute inset-[8%] rounded-full border border-dashed border-primary/20" />

        {/* Nabiz halkasi (ses genligine bagli) */}
        <span
          className="absolute inset-[16%] rounded-full border border-primary/45 transition-[transform,opacity,box-shadow] duration-100 ease-out"
          style={{
            transform: `scale(${1 + level * 0.16})`,
            opacity: 0.45 + level * 0.55,
            boxShadow: `0 0 ${12 + level * 42}px oklch(0.8 0.13 190 / ${0.18 + level * 0.5})`,
          }}
        />

        {/* Bosta bekleme nefesi */}
        {!active && (
          <span className="animate-hud-breathe absolute inset-[26%] rounded-full border border-primary/35" />
        )}

        {/* Cekirdek */}
        <span
          className="absolute inset-[34%] rounded-full bg-primary/10 backdrop-blur-sm transition-transform duration-100 ease-out"
          style={{ transform: `scale(${1 + level * 0.1})` }}
        >
          <span className="absolute inset-0 flex items-center justify-center gap-[3px]">
            {(levels && levels.length > 0 ? levels.slice(0, 5) : new Array(5).fill(0)).map(
              (value, index) => (
                <span
                  key={index}
                  className="w-[3px] rounded-full bg-primary transition-[height,opacity] duration-75 ease-out"
                  style={{
                    height: `${active ? Math.max(6, Math.round(value * 30)) : 6}px`,
                    opacity: active ? 0.6 + value * 0.4 : 0.45,
                  }}
                />
              ),
            )}
          </span>
        </span>
      </div>

      {label ? (
        <span className="hud-text text-[11px] text-primary/80">{label}</span>
      ) : null}
    </div>
  );
}

/** Satir ici kompakt HUD halkasi (mesaj altindaki "konusuyor" gostergesi). */
export function VoiceWave({
  active,
  label,
  levels,
}: {
  active: boolean;
  label?: string;
  levels?: number[];
}) {
  const level = active ? peak(levels) : 0;

  return (
    <div className="flex items-center gap-2.5">
      <span className="relative block h-8 w-8">
        <span
          className="absolute inset-0 rounded-full bg-primary/30 blur-md transition-[transform,opacity] duration-100 ease-out"
          style={{ transform: `scale(${0.8 + level * 0.6})`, opacity: 0.3 + level * 0.6 }}
        />
        <span className="animate-hud-spin absolute inset-0 rounded-full border border-primary/30 border-t-primary/70" />
        <span
          className="absolute inset-[22%] rounded-full border border-primary/60 transition-transform duration-100 ease-out"
          style={{ transform: `scale(${1 + level * 0.3})` }}
        />
      </span>
      {label ? <span className="hud-text text-[10px] text-primary/80">{label}</span> : null}
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
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] font-bold tracking-widest text-primary">
        C2
      </span>
    </div>
  );
}
