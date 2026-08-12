import { useEffect, useMemo, useRef, useState } from "react";

import type { Language, MemoryLink, MemoryRecord } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = {
  language: Language;
  records: MemoryRecord[];
  links: MemoryLink[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type Node = {
  id: string;
  record: MemoryRecord;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Vurgu yogunlugu (0..1) — yumusak gecis icin animasyonla yaklasir */
  glow: number;
};

const WIDTH = 900;
const HEIGHT = 560;

/** CSS degiskenini canvas icin okunabilir renge cevirir. */
function cssColor(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/**
 * Hafiza kayitlari arasindaki anlamsal baglantilarin canvas tabanlı,
 * guc-yonlendirmeli (force-directed) gorsel agi.
 * - Alakali kayitlar birbirine yakin durur (yay + itme kuvvetleri)
 * - Hover/secim: bagli dugumler vurgulanir, alakasizlar soluklasir
 * - Tekerlek ile zoom, surukleyerek pan
 * - Cizim canvas 2D uzerinde; yuzlerce kayitta da akici kalir
 */
export function MemoryGraph({ language, records, links, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; moved: boolean }>({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);

  const adjacency = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const link of links) {
      if (!map.has(link.source)) map.set(link.source, new Map());
      if (!map.has(link.target)) map.set(link.target, new Map());
      map.get(link.source)!.set(link.target, link.weight);
      map.get(link.target)!.set(link.source, link.weight);
    }
    return map;
  }, [links]);

  // Dugum listesini kayitlarla senkronla (mevcut konumlari koru)
  useEffect(() => {
    const existing = new Map(nodesRef.current.map((node) => [node.id, node]));
    nodesRef.current = records.map((record, index) => {
      const previous = existing.get(record.id);
      if (previous) return { ...previous, record };
      const angle = (index / Math.max(records.length, 1)) * Math.PI * 2;
      const radius = record.scope === "short" ? 90 : 200;
      return {
        id: record.id,
        record,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        glow: 0,
      };
    });
  }, [records]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;

    let frame = 0;
    const visibleLinks = () =>
      links.filter(
        (link) =>
          nodesRef.current.some((node) => node.id === link.source) &&
          nodesRef.current.some((node) => node.id === link.target),
      );

    const step = () => {
      const nodes = nodesRef.current;
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const active = hoverRef.current ?? selectedId;
      const neighbours = active ? adjacency.get(active) : undefined;

      // --- Kuvvetler ---
      const repulsion = 5200;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distanceSq = dx * dx + dy * dy;
          if (distanceSq < 1) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            distanceSq = 1;
          }
          const force = repulsion / distanceSq;
          const distance = Math.sqrt(distanceSq);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const link of visibleLinks()) {
        const a = byId.get(link.source);
        const b = byId.get(link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        // Daha alakali kayitlar -> daha kisa ideal mesafe
        const rest = 250 - Math.min(link.weight, 1) * 165;
        const force = (distance - rest) * 0.008 * (0.4 + link.weight);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const node of nodes) {
        // Merkeze cekim + surtunme
        node.vx += (WIDTH / 2 - node.x) * 0.0015;
        node.vy += (HEIGHT / 2 - node.y) * 0.0015;
        node.vx *= 0.82;
        node.vy *= 0.82;
        node.x += Math.max(-6, Math.min(6, node.vx));
        node.y += Math.max(-6, Math.min(6, node.vy));

        const target = !active
          ? 0.55
          : node.id === active
            ? 1
            : neighbours?.has(node.id)
              ? 0.85
              : 0.12;
        node.glow += (target - node.glow) * 0.12;
      }

      // --- Cizim ---
      const primary = cssColor("--primary", "oklch(0.8 0.13 190)");
      const foreground = cssColor("--foreground", "#e6f6ff");

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, WIDTH, HEIGHT);
      const view = viewRef.current;
      context.translate(view.x, view.y);
      context.scale(view.scale, view.scale);

      for (const link of visibleLinks()) {
        const a = byId.get(link.source);
        const b = byId.get(link.target);
        if (!a || !b) continue;
        const emphasised =
          !active || link.source === active || link.target === active
            ? Math.max(a.glow, b.glow)
            : Math.min(a.glow, b.glow);
        context.globalAlpha = 0.1 + emphasised * (0.2 + link.weight * 0.55);
        context.strokeStyle = primary;
        context.lineWidth = (0.4 + link.weight * 2.6) * (0.6 + emphasised * 0.9);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }

      for (const node of nodes) {
        const radius = (node.record.scope === "short" ? 6 : 5) + node.glow * 4;
        const pulse = 1 + Math.sin(frame * 0.05 + node.x * 0.01) * 0.08 * node.glow;

        context.globalAlpha = 0.1 + node.glow * 0.35;
        context.fillStyle = primary;
        context.beginPath();
        context.arc(node.x, node.y, radius * 3.6 * pulse, 0, Math.PI * 2);
        context.fill();

        context.globalAlpha = 0.35 + node.glow * 0.65;
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fill();

        if (node.glow > 0.35) {
          context.globalAlpha = node.glow;
          context.fillStyle = foreground;
          context.font = "10px var(--font-mono, monospace)";
          context.textAlign = "center";
          context.fillText(node.record.title.slice(0, 24), node.x, node.y - radius - 7);
        }
      }
      context.globalAlpha = 1;

      frame += 1;
      animation = requestAnimationFrame(step);
    };

    let animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [adjacency, links, selectedId]);

  const toWorld = (event: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const py = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const view = viewRef.current;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale, px, py };
  };

  const nodeAt = (x: number, y: number) =>
    nodesRef.current.find((node) => (node.x - x) ** 2 + (node.y - y) ** 2 < 220);

  return (
    <div className="space-y-2">
      <div className="surface-card relative overflow-hidden rounded-2xl">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t(language, "graphView")}
          className="h-[320px] w-full touch-none sm:h-[440px]"
          style={{ cursor: dragRef.current.active ? "grabbing" : "grab" }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              active: true,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const { x, y } = toWorld(event);
            const drag = dragRef.current;
            if (drag.active) {
              const dx = event.clientX - drag.startX;
              const dy = event.clientY - drag.startY;
              if (Math.abs(dx) + Math.abs(dy) > 3) {
                drag.moved = true;
                viewRef.current.x += dx;
                viewRef.current.y += dy;
                drag.startX = event.clientX;
                drag.startY = event.clientY;
              }
              return;
            }
            const hit = nodeAt(x, y);
            hoverRef.current = hit?.id ?? null;
            setHoverTitle(hit?.record.title ?? null);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            dragRef.current = { ...drag, active: false };
            if (drag.moved) return;
            const { x, y } = toWorld(event);
            const hit = nodeAt(x, y);
            if (hit) onSelect(hit.id);
          }}
          onPointerLeave={() => {
            dragRef.current.active = false;
            hoverRef.current = null;
            setHoverTitle(null);
          }}
          onWheel={(event) => {
            event.preventDefault();
            const { x, y, px, py } = toWorld(event);
            const view = viewRef.current;
            const next = Math.max(0.4, Math.min(3, view.scale * (event.deltaY < 0 ? 1.12 : 0.89)));
            view.scale = next;
            view.x = px - x * next;
            view.y = py - y * next;
          }}
        />
        {hoverTitle && (
          <span className="hud-text pointer-events-none absolute top-2 left-3 rounded-full border border-primary/30 bg-background/80 px-2 py-1 text-[10px] text-primary">
            {hoverTitle}
          </span>
        )}
      </div>
      <p className="hud-text text-[10px] text-muted-foreground opacity-70">
        {t(language, "graphHint")}
      </p>
    </div>
  );
}
