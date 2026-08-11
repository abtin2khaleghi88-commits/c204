/**
 * ============================================================================
 * HAFIZA KATMANI / MEMORY LAYER  —  TEK MERKEZI CAGRI: `retrieveMemory()`
 * ============================================================================
 * `callLocalAi()` (AI) ve `synthesizeSpeech()` (TTS) gibi, hafiza erisimi de
 * TEK bir fonksiyondan gecer: `retrieveMemory()`.
 *
 * ONEMLI DAVRANIS (eski hatali surumden farki):
 *   ESKI (YANLIS): tum uzun sureli kayitlar okunup prompt'a eklenirdi
 *                  (kelime eslesmesi + tum metin -> yavas ve verimsiz).
 *   YENI (DOGRU) : embedding + cosine benzerligi ile SADECE en alakali
 *                  top-K (varsayilan 4) kayit cekilir; skoru esigin altinda
 *                  kalan hicbir kayit modele gosterilmez.
 *
 * KISA SURELI HAFIZA: arama YAPILMAZ. Son 2 konusmanin kisa ozeti sabit,
 * kucuk bir veri olarak hazir tutulur ve yalnizca kullanici acikca isterse
 * (useShortTerm) prompt'a eklenir.
 *
 * Kendi sisteminizi baglamak icin degistirmeniz gereken yerler:
 *   - `searchLongTermMemory` -> Chroma / kendi vektor DB sorgunuz
 *   - `embedText` (memory-embeddings.server.ts) -> kendi embedding modeliniz
 *   - `retrieveMemory` arayuzu ayni kalsin; tum uygulama bunu cagirir.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";
import { cosineSimilarity, embedText } from "@/lib/backend/memory-embeddings.server";

export type MemoryScope = "short" | "long";

export type MemoryRecord = {
  id: string;
  scope: MemoryScope;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  approved: boolean;
};

export type MemoryHit = {
  id: string;
  title: string;
  content: string;
  scope: MemoryScope;
  category: string;
  /** 0..1 anlamsal alaka skoru */
  score: number;
};

export type MemoryLink = { source: string; target: string; weight: number };

export type RetrieveMemoryResult = {
  /** Prompt'a eklenecek nihai baglam metni (sadece secilen kayitlardan) */
  context: string;
  /** UI'da gosterilecek: hangi kayitlar, ne kadar alakali */
  hits: MemoryHit[];
  shortTermUsed: boolean;
  /** Taranan toplam kayit sayisi (seffaflik gostergesi) */
  scanned: number;
  tookMs: number;
};

/** Uzun sureli aramada modele verilecek maksimum kayit sayisi. */
export const LONG_TERM_TOP_K = 4;
/** Bu skorun altindaki kayitlar hic gosterilmez. */
export const RELEVANCE_THRESHOLD = 0.12;

const store = new Map<string, MemoryRecord>();
const vectors = new Map<string, number[]>();

function indexRecord(record: MemoryRecord) {
  vectors.set(
    record.id,
    embedText(`${record.title} ${record.content} ${record.category} ${record.tags.join(" ")}`),
  );
}

function seed() {
  if (store.size > 0) return;
  const now = new Date().toISOString();
  const demo: Omit<MemoryRecord, "createdAt">[] = [
    {
      id: "short-1",
      scope: "short",
      title: "Son konusma ozeti #1",
      content: "Kullanici yerel AI + TTS arayuzu kuruyor; mavi/turkuaz HUD tasarimi tercih etti.",
      category: "conversation",
      tags: ["arayuz", "tasarim"],
      approved: true,
    },
    {
      id: "short-2",
      scope: "short",
      title: "Son konusma ozeti #2",
      content: "Hafiza sistemi vektor tabanli olacak; ucretli servis kullanilmayacak.",
      category: "conversation",
      tags: ["hafiza", "mimari"],
      approved: true,
    },
    {
      id: "long-1",
      scope: "long",
      title: "Yanit tercihi",
      content: "Kullanici Turkce yanitlari kisa ve maddeler halinde tercih ediyor.",
      category: "preference",
      tags: ["dil", "uslup"],
      approved: true,
    },
    {
      id: "long-2",
      scope: "long",
      title: "Teknik yigin",
      content:
        "Yerel AI Ollama uzerinden http://localhost:11434, TTS http://localhost:8880/synthesize, vektor DB Chroma http://localhost:8000.",
      category: "technical",
      tags: ["ollama", "chroma", "tts"],
      approved: true,
    },
    {
      id: "long-3",
      scope: "long",
      title: "Temel kural",
      content:
        "Sistemde ucretli veya token limitli hicbir API kullanilmaz; her sey yerel ve sinirsiz calisir.",
      category: "rule",
      tags: ["ucretsiz", "yerel"],
      approved: true,
    },
  ];
  demo.forEach((record) => {
    const full: MemoryRecord = { ...record, createdAt: now };
    store.set(full.id, full);
    indexRecord(full);
  });
}

export function listMemories(): MemoryRecord[] {
  seed();
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Kayitlar arasi anlamsal baglantilar (nöron agi gorunumu icin). */
export function memoryGraphLinks(minWeight = 0.2): MemoryLink[] {
  seed();
  const records = [...store.values()];
  const links: MemoryLink[] = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const a = vectors.get(records[i]!.id);
      const b = vectors.get(records[j]!.id);
      if (!a || !b) continue;
      const weight = cosineSimilarity(a, b);
      if (weight >= minWeight) {
        links.push({ source: records[i]!.id, target: records[j]!.id, weight });
      }
    }
  }
  return links.sort((x, y) => y.weight - x.weight).slice(0, 60);
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
    category: record.category ?? existing?.category ?? "general",
    tags: record.tags ?? existing?.tags ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    approved: record.approved ?? existing?.approved ?? true,
  };
  store.set(id, next);
  indexRecord(next);
  return next;
}

export function deleteMemory(id: string): void {
  store.delete(id);
  vectors.delete(id);
}

export function deleteMemories(ids: string[]): number {
  let removed = 0;
  ids.forEach((id) => {
    if (store.delete(id)) {
      vectors.delete(id);
      removed += 1;
    }
  });
  return removed;
}

/**
 * KISA SURELI HAFIZA: arama yok. Sabit, kucuk veri (son N konusma ozeti).
 */
export function getShortTermMemory(): MemoryRecord[] {
  seed();
  const { memory } = getLocalStackConfig();
  return listMemories()
    .filter((record) => record.scope === "short" && record.approved)
    .slice(0, memory.shortTermConversationCount);
}

/** Konusma ozeti kaydeder ve yalnizca son N tanesini tutar. */
export function rememberConversationSummary(summary: string): MemoryRecord {
  const record = upsertMemory({
    scope: "short",
    title: `Son konusma ozeti · ${new Date().toLocaleTimeString("tr-TR")}`,
    content: summary.slice(0, 400),
    category: "conversation",
    approved: true,
  });
  const { memory } = getLocalStackConfig();
  const extra = listMemories()
    .filter((r) => r.scope === "short")
    .slice(memory.shortTermConversationCount);
  deleteMemories(extra.map((r) => r.id));
  return record;
}

/**
 * UZUN SURELI HAFIZA ARAMASI — vektor benzerligi, top-K.
 * TUM kayitlar DONDURULMEZ; sadece esigi gecen en alakali K kayit.
 * Chroma vb. baglayacaksaniz bu fonksiyonun govdesini degistirmeniz yeterli.
 */
export async function searchLongTermMemory(
  query: string,
  topK = LONG_TERM_TOP_K,
): Promise<MemoryHit[]> {
  seed();
  const { memory } = getLocalStackConfig();

  if (memory.enabled) {
    // TODO (siz): Chroma benzerlik sorgusu — ayni sekilde SADECE top-K dondurun.
    // const res = await fetch(`${memory.baseUrl}/api/v1/collections/${memory.collection}/query`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ query_texts: [query], n_results: topK }),
    // })
    // return mapChromaResultsToHits(await res.json())
  }

  if (!query.trim()) return [];
  const queryVector = embedText(query);

  return [...store.values()]
    .filter((record) => record.scope === "long" && record.approved)
    .map((record) => ({
      id: record.id,
      title: record.title,
      content: record.content,
      scope: record.scope,
      category: record.category,
      score: cosineSimilarity(queryVector, vectors.get(record.id) ?? []),
    }))
    .filter((hit) => hit.score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * ============================================================================
 * >>> HAFIZA ERISIMININ TEK MERKEZI NOKTASI / SINGLE MEMORY ENTRY POINT <<<
 * ============================================================================
 * "Tum metni oku" DEGIL, "anlamca en alakali N kaydi getir".
 */
export async function retrieveMemory(options: {
  query: string;
  useShortTerm: boolean;
  useLongTerm: boolean;
  topK?: number;
}): Promise<RetrieveMemoryResult> {
  const startedAt = Date.now();
  seed();

  const chunks: string[] = [];
  const hits: MemoryHit[] = [];
  let shortTermUsed = false;

  if (options.useShortTerm) {
    const short = getShortTermMemory();
    if (short.length > 0) {
      shortTermUsed = true;
      chunks.push(
        `[Kisa sureli hafiza — son ${short.length} konusma ozeti]\n${short
          .map((record) => `- ${record.content}`)
          .join("\n")}`,
      );
      short.forEach((record) =>
        hits.push({
          id: record.id,
          title: record.title,
          content: record.content,
          scope: "short",
          category: record.category,
          score: 1,
        }),
      );
    }
  }

  if (options.useLongTerm) {
    const found = await searchLongTermMemory(options.query, options.topK ?? LONG_TERM_TOP_K);
    if (found.length > 0) {
      chunks.push(
        `[Uzun sureli hafiza — en alakali ${found.length} kayit]\n${found
          .map((hit) => `- (${(hit.score * 100).toFixed(0)}%) ${hit.title}: ${hit.content}`)
          .join("\n")}`,
      );
      hits.push(...found);
    }
  }

  const scanned = [...store.values()].filter((record) => record.scope === "long").length;

  return {
    context: chunks.join("\n\n"),
    hits,
    shortTermUsed,
    scanned,
    tookMs: Date.now() - startedAt,
  };
}
