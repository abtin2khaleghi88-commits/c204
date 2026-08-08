/**
 * Frontend istemcisi: /api/assistant ucunun ince sarmalayicisi.
 * Frontend client: thin wrapper over the single /api/assistant endpoint.
 */

import {
  playAudioSource,
  playBrowserSpeech,
  type PlaybackHandle,
} from "@/lib/audio-player";

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
  createdAt: string;
  approved: boolean;
};

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

export function sendChat(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  language: Language;
  useShortTerm: boolean;
  useLongTerm: boolean;
  attachments: { name: string; excerpt: string }[];
}) {
  return post<{ content: string; source: "local" | "mock"; usedMemory: boolean }>({
    action: "chat",
    ...input,
  });
}

export function listMemories() {
  return post<{ records: MemoryRecord[] }>({ action: "memory.list" });
}

export function upsertMemory(record: Partial<MemoryRecord>) {
  return post<{ record: MemoryRecord }>({ action: "memory.upsert", record });
}

export function deleteMemory(id: string) {
  return post<{ ok: boolean }>({ action: "memory.delete", id });
}

/**
 * TTS: tek merkezi uc (`POST /api/assistant` + action:"tts") cagrilir.
 * Backend ne dondururse dondurmez, oynatici genel:
 *   - audio/* govde   -> blob olarak calinir
 *   - { audio: "<base64>" } JSON -> base64 olarak calinir
 *   - { fallback: true } -> yerel TTS tanimli degil, tarayici sesi kullanilir
 *
 * Kendi TTS motorunuzu baglamak icin SADECE
 * src/lib/backend/tts-provider.server.ts dosyasini degistirin.
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

  if (res.ok && contentType.startsWith("audio")) {
    return playAudioSource(await res.blob(), handlers);
  }

  if (res.ok && contentType.includes("json")) {
    const payload = (await res.json()) as { audio?: string; fallback?: boolean };
    if (payload.audio) return playAudioSource(payload.audio, handlers);
  }

  return playBrowserSpeech(text, language === "tr" ? "tr-TR" : "en-US", handlers);
}

