import { useMemo } from "react";

import type { Language, MemoryLink, MemoryRecord } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = {
  language: Language;
  records: MemoryRecord[];
  links: MemoryLink[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Hafiza kayitlari arasindaki anlamsal baglantilarin gorsel agi.
 * Konumlar deterministik bir daire uzerine yerlestirilir (hizli, sabit).
 */
export function MemoryGraph({ language, records, links, selectedId, onSelect }: Props) {
  const size = 420;
  const nodes = useMemo(() => {
    const center = size / 2;
    return records.map((record, index) => {
      const angle = (index / Math.max(records.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = record.scope === "short" ? size * 0.18 : size * 0.36;
      return {
        record,
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      };
    });
  }, [records]);

  const positions = new Map(nodes.map((node) => [node.record.id, node]));

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[320px] w-full sm:h-[420px]"
        role="img"
        aria-label={t(language, "graphView")}
      >
        <defs>
          <radialGradient id="memory-node-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {links.map((link) => {
          const a = positions.get(link.source);
          const b = positions.get(link.target);
          if (!a || !b) return null;
          const active = selectedId === link.source || selectedId === link.target;
          return (
            <line
              key={`${link.source}-${link.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={active ? "text-primary" : "text-primary/40"}
              stroke="currentColor"
              strokeWidth={active ? 1.6 : 0.5 + link.weight * 1.4}
              strokeOpacity={active ? 0.9 : 0.25 + link.weight * 0.4}
            />
          );
        })}

        {nodes.map((node) => {
          const active = selectedId === node.record.id;
          return (
            <g
              key={node.record.id}
              className="cursor-pointer text-primary"
              onClick={() => onSelect(node.record.id)}
            >
              <circle cx={node.x} cy={node.y} r={22} fill="url(#memory-node-glow)" />
              <circle
                cx={node.x}
                cy={node.y}
                r={active ? 9 : 6}
                className={active ? "fill-primary" : "fill-primary/70"}
                stroke="currentColor"
                strokeOpacity={0.6}
                strokeWidth={1}
              >
                <animate
                  attributeName="r"
                  values={`${active ? 9 : 6};${active ? 11 : 7.2};${active ? 9 : 6}`}
                  dur={`${2.4 + (node.x % 7) * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <text
                x={node.x}
                y={node.y - 14}
                textAnchor="middle"
                className="fill-foreground text-[8px]"
                style={{ fontFamily: "var(--font-mono, monospace)" }}
              >
                {node.record.title.slice(0, 18)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="hud-text text-[10px] text-muted-foreground opacity-70">
        {t(language, "graphHint")}
      </p>
    </div>
  );
}
