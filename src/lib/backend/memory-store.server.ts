/**
 * ============================================================================
 * HAFIZA KATMANI ISKELETI / MEMORY LAYER SKELETON
 * ============================================================================
 * Kisa sureli hafiza: son N konusmanin ozeti (basit anahtar-deger kaydi).
 * Uzun sureli hafiza: yerel vektor veritabani (Chroma) icin hazir arayuz.
 *
 * Su an bellekte (in-memory) tutulur. Kendi sisteminizi baglamak icin sadece
 * asagidaki fonksiyon govdelerini degistirin:
 *   - listMemories / upsertMemory / deleteMemory  (yonetim paneli)
 *   - searchLongTermMemory                        (Chroma sorgusu)
 *   - buildMemoryContext                          (prompt'a eklenen metin)
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type MemoryScope = "short" | "long";

export type MemoryRecord = {
  id: string;
  scope: MemoryScope;
  title: string;
  content: string;
  createdAt: string;
  /** Kullanici bu kaydin kullanilmasini onayladi mi? */
  approved: boolean;
};

const store = new Map<string, MemoryRecord>();

function seed() {
  if (store.size > 0) return;
  const now = new Date().toISOString();
  const demo: MemoryRecord[] = [
    {
      id: "short-1",
      scope: "short",
      title: "Son konusma ozeti #1",
      content: "Kullanici yerel AI + TTS arayuzu kurmak istiyor. Mavi tonlu bir tasarim tercih etti.",
      createdAt: now,
      approved: true,
    },
    {
      id: "short-2",
      scope: "short",
      title: "Son konusma ozeti #2",
      content: "Hafiza yonetimi paneli ve dosya yukleme ozellikleri konusuldu.",
      createdAt: now,
      approved: true,
    },
    {
      id: "long-1",
      scope: "long",
      title: "Kullanici tercihi",
      content: "Kullanici Turkce yanitlari kisa ve maddeler halinde tercih ediyor.",
      createdAt: now,
      approved: true,
    },
  ];
  demo.forEach((r) => store.set(r.id, r));
}

export function listMemories(): MemoryRecord[] {
  seed();
  const { memory } = getLocalStackConfig();
  const all = [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const short = all
    .filter((r) => r.scope === "short")
    .slice(0, memory.shortTermConversationCount);
  const long = all.filter((r) => r.scope === "long");
  return [...short, ...long];
}

export function upsertMemory(record: Partial<MemoryRecord> & { id?: string }): MemoryRecord {
  seed();
  const id = record.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existing = store.get(id);
  const next: MemoryRecord = {
    id,
    scope: record.scope ?? existing?.scope ?? "long",
    title: record.title ?? existing?.title ?? "Yeni kayit",
    content: record.content ?? existing?.content ?? "",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    approved: record.approved ?? existing?.approved ?? true,
  };
  store.set(id, next);
  return next;
}

export function deleteMemory(id: string): void {
  store.delete(id);
}

/**
 * UZUN SURELI HAFIZA ARAMASI - Chroma baglanti noktasi.
 * LOCAL_MEMORY_BASE_URL tanimliysa burada gercek vektor sorgusu yapilir.
 */
export async function searchLongTermMemory(query: string, limit = 3): Promise<MemoryRecord[]> {
  seed();
  const { memory } = getLocalStackConfig();

  if (memory.enabled) {
    // TODO (siz): Chroma sorgusu. Ornek:
    // const res = await fetch(`${memory.baseUrl}/api/v1/collections/${memory.collection}/query`, {...})
    // return mapChromaResultsToMemoryRecords(await res.json())
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...store.values()]
    .filter((r) => r.scope === "long" && r.approved)
    .filter((r) =>
      terms.length === 0
        ? true
        : terms.some((t) => `${r.title} ${r.content}`.toLowerCase().includes(t)),
    )
    .slice(0, limit);
}

/** Prompt'a eklenecek hafiza metnini olusturur. */
export async function buildMemoryContext(options: {
  query: string;
  useShortTerm: boolean;
  useLongTerm: boolean;
}): Promise<string> {
  const chunks: string[] = [];

  if (options.useShortTerm) {
    const short = listMemories().filter((r) => r.scope === "short" && r.approved);
    if (short.length) {
      chunks.push(`[Kisa sureli hafiza]\n${short.map((r) => `- ${r.content}`).join("\n")}`);
    }
  }

  if (options.useLongTerm) {
    const long = await searchLongTermMemory(options.query);
    if (long.length) {
      chunks.push(`[Uzun sureli hafiza]\n${long.map((r) => `- ${r.content}`).join("\n")}`);
    }
  }

  return chunks.join("\n\n");
}
