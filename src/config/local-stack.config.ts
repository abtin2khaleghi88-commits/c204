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
 *   # --- TTS (motor secimi) ---
 *   TTS_PROVIDER=lovable            # lovable | elevenlabs | azure | google | local
 *   TTS_MODEL=openai/gpt-4o-mini-tts
 *   TTS_VOICE=alloy
 *   ELEVENLABS_API_KEY=...          # TTS_PROVIDER=elevenlabs
 *   ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
 *   ELEVENLABS_MODEL=eleven_multilingual_v2
 *   AZURE_SPEECH_KEY=...            # TTS_PROVIDER=azure
 *   AZURE_SPEECH_REGION=westeurope
 *   GOOGLE_TTS_API_KEY=...          # TTS_PROVIDER=google
 *   LOCAL_TTS_URL=http://localhost:5002/api/tts   # TTS_PROVIDER=local
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
  const provider = (env("TTS_PROVIDER") || "lovable") as TtsProvider;

  return {
    ai: {
      baseUrl: aiBaseUrl || "http://localhost:11434",
      chatPath: env("LOCAL_AI_CHAT_PATH") || "/api/chat",
      model: env("LOCAL_AI_MODEL") || "llama3.1",
      enabled: Boolean(aiBaseUrl),
    },
    tts: {
      provider,
      lovable: {
        apiKey: env("LOVABLE_API_KEY"),
        model: env("TTS_MODEL") || "openai/gpt-4o-mini-tts",
        voice: env("TTS_VOICE") || "alloy",
      },
      elevenlabs: {
        apiKey: env("ELEVENLABS_API_KEY"),
        voiceId: env("ELEVENLABS_VOICE_ID") || "EXAVITQu4vr4xnSDxMaL",
        model: env("ELEVENLABS_MODEL") || "eleven_multilingual_v2",
      },
      azure: {
        apiKey: env("AZURE_SPEECH_KEY"),
        region: env("AZURE_SPEECH_REGION") || "westeurope",
        voiceTr: env("AZURE_VOICE_TR") || "tr-TR-EmelNeural",
        voiceEn: env("AZURE_VOICE_EN") || "en-US-JennyNeural",
      },
      google: {
        apiKey: env("GOOGLE_TTS_API_KEY"),
        voiceTr: env("GOOGLE_VOICE_TR") || "tr-TR-Wavenet-D",
        voiceEn: env("GOOGLE_VOICE_EN") || "en-US-Neural2-F",
      },
      local: { url: env("LOCAL_TTS_URL") },
    },
    memory: {
      baseUrl: memoryBaseUrl || "http://localhost:8000",
      shortTermConversationCount: Number(env("MEMORY_SHORT_TERM_COUNT") || 2),
      collection: env("MEMORY_COLLECTION") || "local_assistant_memory",
      enabled: Boolean(memoryBaseUrl),
    },
  };
}
