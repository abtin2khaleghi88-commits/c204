/**
 * ============================================================================
 * MERKEZI YAPILANDIRMA / CENTRAL CONFIGURATION
 * ============================================================================
 * Yerel AI, TTS ve hafiza (memory) baglanti noktalarinin TEK yeri.
 * The single place where local AI, TTS and memory endpoints are configured.
 *
 * .env (sunucu tarafi):
 *
 *   # --- AI ---
 *   LOCAL_AI_BASE_URL=http://localhost:11434     # Ollama
 *   LOCAL_AI_CHAT_PATH=/api/chat
 *   LOCAL_AI_MODEL=llama3.1
 *
 *   # --- TTS (SADECE yerel sunucu; ucretli saglayici YOK) ---
 *   LOCAL_TTS_URL=http://localhost:8880/synthesize
 *   LOCAL_TTS_TIMEOUT_MS=8000
 *
 *   # --- Hafiza ---
 *   LOCAL_MEMORY_BASE_URL=http://localhost:8000  # Chroma
 * ============================================================================
 */

/** Tek desteklenen motor: sizin yerel TTS sunucunuz. */
export type TtsProvider = "local";

export type LocalStackConfig = {
  ai: {
    baseUrl: string;
    chatPath: string;
    model: string;
    /** true -> gercek yerel AI sunucusu kullanilir */
    enabled: boolean;
  };
  tts: {
    provider: TtsProvider;
    /** Yerel TTS sunucusu endpoint'i (varsayilan http://localhost:8880/synthesize) */
    url: string;
    /** Istek zaman asimi (ms) — sunucu kapaliysa hizli dusmek icin */
    timeoutMs: number;
  };
  stt: {
    /** Yerel Whisper sunucusu endpoint'i (varsayilan http://localhost:9000/transcribe) */
    url: string;
    timeoutMs: number;
  };
  memory: {
    baseUrl: string;
    /** Kisa sureli hafizada tutulacak konusma ozeti sayisi */
    shortTermConversationCount: number;
    /** Uzun sureli hafiza (Chroma) koleksiyon adi */
    collection: string;
    enabled: boolean;
  };
};

/** SADECE sunucu tarafinda cagirin (server function / api route handler icinde). */
export function getLocalStackConfig(): LocalStackConfig {
  const env = (key: string) => process.env[key]?.trim() || "";

  const aiBaseUrl = env("LOCAL_AI_BASE_URL");
  const memoryBaseUrl = env("LOCAL_MEMORY_BASE_URL");

  return {
    ai: {
      baseUrl: aiBaseUrl || "http://localhost:11434",
      chatPath: env("LOCAL_AI_CHAT_PATH") || "/api/chat",
      model: env("LOCAL_AI_MODEL") || "llama3.1",
      enabled: Boolean(aiBaseUrl),
    },
    tts: {
      provider: "local",
      url: env("LOCAL_TTS_URL") || "http://localhost:8880/synthesize",
      timeoutMs: Number(env("LOCAL_TTS_TIMEOUT_MS") || 8000),
    },
    stt: {
      url: env("LOCAL_STT_URL") || "http://localhost:9000/transcribe",
      timeoutMs: Number(env("LOCAL_STT_TIMEOUT_MS") || 15000),
    },
    memory: {
      baseUrl: memoryBaseUrl || "http://localhost:8000",
      shortTermConversationCount: Number(env("MEMORY_SHORT_TERM_COUNT") || 2),
      collection: env("MEMORY_COLLECTION") || "local_assistant_memory",
      enabled: Boolean(memoryBaseUrl),
    },
  };
}
