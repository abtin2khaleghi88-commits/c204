import { Sparkles } from "lucide-react";

import type { Language, MemoryHit } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

/**
 * Hafiza isabet gostergesi: HANGI kayit, NE KADAR alakali.
 * Skor `retrieveMemory()` icindeki cosine benzerliginden gelir.
 */
export function MemoryHits({
  language,
  hits,
  scanned,
  tookMs,
}: {
  language: Language;
  hits: MemoryHit[];
  scanned?: number;
  tookMs?: number;
}) {
  if (hits.length === 0) return null;

  return (
    <div className="mb-2 space-y-1.5">
      <p className="hud-text flex items-center gap-1.5 text-[10px] text-primary/80">
        <Sparkles className="h-3 w-3" />
        {t(language, "memoryHits")} · {hits.length}/{scanned ?? hits.length}{" "}
        {t(language, "scannedRecords")}
        {typeof tookMs === "number" ? ` · ${tookMs}ms` : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {hits.map((hit) => (
          <span
            key={hit.id}
            title={hit.content}
            className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1"
          >
            <span className="hud-text max-w-[180px] truncate text-[10px] text-foreground/80">
              {hit.scope === "short" ? "◇" : "◆"} {hit.title}
            </span>
            <span className="relative h-1 w-10 overflow-hidden rounded-full bg-border">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.round(hit.score * 100)}%` }}
              />
            </span>
            <span className="hud-text text-[10px] text-primary">
              {Math.round(hit.score * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
