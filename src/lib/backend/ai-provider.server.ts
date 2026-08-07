/**
 * ============================================================================
 * >>> AI CAGRISI BURADA YAPILIR / THE AI CALL HAPPENS HERE <<<
 * ============================================================================
 * Tum kod tabaninda yapay zekaya giden TEK nokta: `generateAssistantReply`.
 * The ONLY place in the codebase that talks to a language model.
 *
 * Kendi yerel AI sunucunuzu baglamak icin:
 *   1. .env dosyasina LOCAL_AI_BASE_URL=http://localhost:11434 ekleyin
 *      (ve istege gore LOCAL_AI_MODEL, LOCAL_AI_CHAT_PATH).
 *   2. Baska bir API sekli kullaniyorsaniz sadece `callLocalAi` fonksiyonunun
 *      govdesini degistirin. Baska hicbir dosyaya dokunmaniz gerekmez.
 *
 * `createMockReply` gecici demo cevaplayicidir - silinmek uzere tasarlandi.
 * `createMockReply` is the throwaway demo responder - delete it freely.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessage = { role: ChatRole; content: string };

export type GenerateReplyInput = {
  messages: ChatMessage[];
  language: "tr" | "en";
  /** Prompt'a eklenecek hafiza baglami (kisa + uzun sureli) */
  memoryContext?: string;
  /** Sohbete eklenen dosyalarin metin ozeti */
  attachments?: { name: string; excerpt: string }[];
};

export type GenerateReplyResult = {
  content: string;
  /** "local" = sizin AI sunucunuz, "mock" = gecici demo cevaplayici */
  source: "local" | "mock";
};

function buildSystemPrompt(input: GenerateReplyInput): string {
  const base =
    input.language === "tr"
      ? "Sen tamamen yerel calisan bir yardimci asistansin. Kisa, net ve Turkce yanit ver."
      : "You are a fully local assistant. Answer concisely and clearly in English.";

  const parts = [base];
  if (input.memoryContext) {
    parts.push(
      input.language === "tr"
        ? `Hafiza baglami (kullanici onayli):\n${input.memoryContext}`
        : `Memory context (user approved):\n${input.memoryContext}`,
    );
  }
  if (input.attachments?.length) {
    parts.push(
      `Attached files:\n${input.attachments
        .map((a) => `- ${a.name}: ${a.excerpt.slice(0, 2000)}`)
        .join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

/** Yerel AI sunucusuna istek (Ollama /api/chat uyumlu). */
async function callLocalAi(input: GenerateReplyInput): Promise<string> {
  const { ai } = getLocalStackConfig();

  const response = await fetch(`${ai.baseUrl}${ai.chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.model,
      stream: false,
      messages: [{ role: "system", content: buildSystemPrompt(input) }, ...input.messages],
    }),
  });

  if (!response.ok) {
    throw new Error(`Local AI error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    message?: { content?: string };
    choices?: { message?: { content?: string } }[];
    response?: string;
  };

  return (
    data.message?.content ?? data.choices?.[0]?.message?.content ?? data.response ?? ""
  ).trim();
}

/** GECICI demo cevaplayici - yerel AI baglaninca kaldirilacak. */
function createMockReply(input: GenerateReplyInput): string {
  const last = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (input.language === "tr") {
    return [
      `Demo yanit (yerel AI henuz bagli degil): "${last.slice(0, 160)}"`,
      "",
      "Gercek modeli baglamak icin .env dosyasina LOCAL_AI_BASE_URL=http://localhost:11434 ekleyin.",
      input.memoryContext ? "Bu yanitta hafiza baglami dikkate alindi." : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Demo reply (local AI not connected yet): "${last.slice(0, 160)}"`,
    "",
    "Set LOCAL_AI_BASE_URL=http://localhost:11434 in .env to plug in your own model.",
    input.memoryContext ? "Memory context was taken into account." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateAssistantReply(
  input: GenerateReplyInput,
): Promise<GenerateReplyResult> {
  const { ai } = getLocalStackConfig();

  if (!ai.enabled) {
    return { content: createMockReply(input), source: "mock" };
  }

  try {
    const content = await callLocalAi(input);
    return { content: content || createMockReply(input), source: content ? "local" : "mock" };
  } catch (error) {
    console.error("[ai-provider] local AI call failed:", error);
    return {
      content:
        input.language === "tr"
          ? `Yerel AI sunucusuna ulasilamadi (${String(error)}). Demo yanita dusuldu.\n\n${createMockReply(input)}`
          : `Could not reach the local AI server (${String(error)}). Falling back to demo reply.\n\n${createMockReply(input)}`,
      source: "mock",
    };
  }
}
