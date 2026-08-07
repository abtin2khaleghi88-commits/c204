/**
 * ============================================================================
 * MERKEZI YAPILANDIRMA / CENTRAL CONFIGURATION
 * ============================================================================
 * Yerel AI, TTS ve hafiza (memory) baglanti noktalarinin TEK yeri.
 * The single place where local AI, TTS and memory endpoints are configured.
 *
 * Bu dosyadaki degerler .env uzerinden ezilebilir (sunucu tarafi):
 * These values can be overridden with .env (server side only):
 *
 *   LOCAL_AI_BASE_URL=http://localhost:11434     # Ollama
 *   LOCAL_AI_CHAT_PATH=/api/chat
 *   LOCAL_AI_MODEL=llama3.1
 *   LOCAL_TTS_URL=http://localhost:5002/api/tts  # Piper / Coqui vb.
 *   LOCAL_MEMORY_BASE_URL=http://localhost:8000  # Chroma
 *
 * Hicbiri tanimlanmazsa sistem "demo/mock" modda calisir (bkz. ai-provider).
 * If none are set, the system runs in demo/mock mode (see ai-provider).
 * ============================================================================
 */

export type LocalStackConfig = {
  ai: {
    baseUrl: string;
    chatPath: string;
    model: string;
    /** true -> gercek yerel AI sunucusu kullanilir */
    enabled: boolean;
  };
  tts: {
    url: string;
    /** false -> tarayici SpeechSynthesis fallback kullanilir */
    enabled: boolean;
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
  const ttsUrl = env("LOCAL_TTS_URL");
  const memoryBaseUrl = env("LOCAL_MEMORY_BASE_URL");

  return {
    ai: {
      baseUrl: aiBaseUrl || "http://localhost:11434",
      chatPath: env("LOCAL_AI_CHAT_PATH") || "/api/chat",
      model: env("LOCAL_AI_MODEL") || "llama3.1",
      enabled: Boolean(aiBaseUrl),
    },
    tts: {
      url: ttsUrl,
      enabled: Boolean(ttsUrl),
    },
    memory: {
      baseUrl: memoryBaseUrl || "http://localhost:8000",
      shortTermConversationCount: Number(env("MEMORY_SHORT_TERM_COUNT") || 2),
      collection: env("MEMORY_COLLECTION") || "local_assistant_memory",
      enabled: Boolean(memoryBaseUrl),
    },
  };
}
