/**
 * Frontend istemcisi: /api/assistant ucunun ince sarmalayicisi.
 * Frontend client: thin wrapper over the single /api/assistant endpoint.
 */

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
 * TTS: once yerel TTS sunucusu denenir, yoksa tarayici SpeechSynthesis.
 * Returns a cleanup/stop function.
 */
export async function speak(text: string, language: Language): Promise<() => void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tts", text, language }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (res.ok && contentType.startsWith("audio")) {
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    await audio.play().catch(() => {});
    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "tr" ? "tr-TR" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }

  return () => {};
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
