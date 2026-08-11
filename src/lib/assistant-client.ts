/**
 * Frontend istemcisi: /api/assistant ucunun ince sarmalayicisi.
 * Frontend client: thin wrapper over the single /api/assistant endpoint.
 */

import { playAudioSource, type PlaybackHandle } from "@/lib/audio-player";


export type Language = "tr" | "en";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: { name: string; size: number }[];
};

export type MemoryRecord = {
  id: string;
  scope: "short" | "long";
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
  scope: "short" | "long";
  category: string;
  /** 0..1 anlamsal alaka skoru */
  score: number;
};

export type MemoryLink = { source: string; target: string; weight: number };

const ENDPOINT = "/api/assistant";

async function post<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * AKAN SOHBET (SSE). Backend once hafiza isabetlerini, sonra metin parcalarini
 * gonderir. Hafiza tarafi `retrieveMemory()` ile SADECE top-K kaydi kullanir.
 */
export async function streamChat(
  input: {
    messages: { role: "user" | "assistant"; content: string }[];
    language: Language;
    useShortTerm: boolean;
    useLongTerm: boolean;
    attachments: { name: string; excerpt: string }[];
  },
  handlers: {
    onMemory?: (payload: { hits: MemoryHit[]; scanned: number; tookMs: number }) => void;
    onDelta?: (text: string) => void;
    onDone?: (payload: { source: "local" | "mock"; usedMemory: boolean }) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "chat", ...input }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.replace(/^data:\s*/m, "").trim();
      if (!line) continue;
      try {
        const event = JSON.parse(line) as {
          type: string;
          hits?: MemoryHit[];
          scanned?: number;
          tookMs?: number;
          text?: string;
          source?: "local" | "mock";
          usedMemory?: boolean;
          message?: string;
        };
        if (event.type === "memory") {
          handlers.onMemory?.({
            hits: event.hits ?? [],
            scanned: event.scanned ?? 0,
            tookMs: event.tookMs ?? 0,
          });
        } else if (event.type === "delta" && event.text) {
          handlers.onDelta?.(event.text);
        } else if (event.type === "done") {
          handlers.onDone?.({
            source: event.source ?? "mock",
            usedMemory: Boolean(event.usedMemory),
          });
        } else if (event.type === "error") {
          throw new Error(event.message ?? "stream error");
        }
      } catch {
        /* kismi frame - yoksay */
      }
    }
  }
}

export function listMemories() {
  return post<{ records: MemoryRecord[]; links: MemoryLink[]; categories: string[] }>({
    action: "memory.list",
  });
}

export function searchMemories(query: string) {
  return post<{ hits: MemoryHit[] }>({ action: "memory.search", query });
}

export function upsertMemory(record: Partial<MemoryRecord>) {
  return post<{ record: MemoryRecord }>({ action: "memory.upsert", record });
}

export function deleteMemory(id: string) {
  return post<{ ok: boolean }>({ action: "memory.delete", id });
}

export function deleteMemories(ids: string[]) {
  return post<{ removed: number }>({ action: "memory.deleteMany", ids });
}

export function rememberSummary(summary: string) {
  return post<{ record: MemoryRecord }>({ action: "memory.summarize", summary });
}

/**
 * ============================================================================
 * TTS: tek merkezi uc (`POST /api/assistant` + action:"tts") cagrilir.
 * ============================================================================
 * Backend ne dondururse oynatici genel kalir:
 *   - audio/* govde              -> blob olarak calinir
 *   - { audio: "<base64>" } JSON -> base64 olarak calinir
 *   - { fallback: true } JSON    -> yerel TTS sunucusu calismiyor
 *
 * Motoru degistirmek icin SADECE src/lib/backend/tts-provider.server.ts
 * dosyasindaki `callLocalTts()` fonksiyonunu duzenleyin.
 */
export async function speak(
  text: string,
  language: Language,
  handlers: { onLevels?: (levels: number[]) => void; onEnded?: () => void } = {},
): Promise<PlaybackHandle> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tts", text, language }),
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    throw new Error(`TTS failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  if (contentType.startsWith("audio")) {
    return playAudioSource(await res.blob(), handlers);
  }

  const payload = (await res.json().catch(() => ({}))) as {
    audio?: string;
    fallback?: boolean;
    error?: string;
  };
  if (payload.audio) return playAudioSource(payload.audio, handlers);
  if (payload.fallback) return previewFallbackSpeak(text, language, handlers);
  throw new Error(payload.error ?? "TTS returned no audio");
}

/**
 * ============================================================================
 * GECICI ONIZLEME YEDEGI — GERCEK SISTEMDE KULLANILMAZ
 * ============================================================================
 * Yerel TTS sunucusu (LOCAL_TTS_URL) henuz calismiyorsa arayuzun sessiz
 * kalmamasi icin tarayici ici SpeechSynthesis kullanilir. Bu yol yalnizca
 * gelistirme/onizleme kolayligidir; yerel motor baglandigi anda hic
 * cagrilmaz ve silinebilir.
 *
 * Gercek genlik verisi olmadigi icin dalga animasyonu hafif, dusuk yogunluklu
 * bir "konusuyor" gostergesi olarak surulur (AnalyserNode yolu degismez).
 */
function previewFallbackSpeak(
  text: string,
  language: Language,
  handlers: { onLevels?: (levels: number[]) => void; onEnded?: () => void },
): PlaybackHandle {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) {
    handlers.onEnded?.();
    return { stop: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "tr" ? "tr-TR" : "en-US";
  utterance.rate = 1;

  let stopped = false;
  const bands = 9;
  const timer = window.setInterval(() => {
    if (stopped) return;
    handlers.onLevels?.(
      Array.from({ length: bands }, () => 0.12 + Math.random() * 0.18),
    );
  }, 120);

  const finish = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    try {
      synth.cancel();
    } catch {
      /* yoksay */
    }
    handlers.onLevels?.(new Array(bands).fill(0));
    handlers.onEnded?.();
  };

  utterance.onend = finish;
  utterance.onerror = finish;
  synth.cancel();
  synth.speak(utterance);

  return { stop: finish };
}
