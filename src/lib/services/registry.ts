/**
 * ============================================================================
 * SERVIS KAYIT DEFTERI / SERVICE REGISTRY
 * ============================================================================
 * Burada SADECE projede gercekten entegre olan saglayicilar listelenir.
 * Yeni bir saglayici eklerken tek yapmaniz gereken buraya bir kayit eklemek;
 * kullanim panosu ve saglayici yoneticisi otomatik olarak onu tanir.
 * ============================================================================
 */

import type { ServiceDefinition } from "./types";

export const SERVICES: ServiceDefinition[] = [
  {
    id: "ai.ollama",
    name: "Ollama",
    category: "ai",
    feature: "ai",
    providerKind: "local",
    description: {
      tr: "Yerel dil modeli sunucusu (varsayilan model: Qwen3.5 4B).",
      en: "Local language model server (default model: Qwen3.5 4B).",
    },
    details: {
      tr: "C204'un ana AI katmani. Istekler bilgisayarinizdaki Ollama sunucusuna gider, internete cikmaz. Cevrimici bir API kotasi yoktur; sinir donaniminiz, bellek ve model hizidir. C204 istek sayisini yerel olarak sayar.",
      en: "C204's primary AI layer. Requests go to Ollama on your machine and never leave it. There is no online API quota; the limits are your hardware, memory and model speed. C204 counts requests locally.",
    },
    quotaUnit: "requests",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: "ai.demo",
    dataLeavesDevice: "no",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "ai.demo",
    name: "Demo responder",
    category: "ai",
    feature: "ai",
    providerKind: "local",
    description: {
      tr: "Yerel AI bagli degilken devreye giren gecici yanitlayici.",
      en: "Throwaway responder used while the local AI is not connected.",
    },
    details: {
      tr: "Uygulama icinde calisan basit bir yer tutucu. Ag cagrisi yapmaz, kota tuketmez. Ollama baglandigi anda kullanilmaz.",
      en: "A simple in-app placeholder. It makes no network calls and consumes no quota. Once Ollama is connected it is not used.",
    },
    quotaUnit: "requests",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: null,
    dataLeavesDevice: "no",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "stt.local",
    name: "Local Whisper server",
    category: "stt",
    feature: "stt",
    providerKind: "local",
    description: {
      tr: "Kendi bilgisayarinizdaki Whisper / faster-whisper sunucusu.",
      en: "Your own Whisper / faster-whisper server.",
    },
    details: {
      tr: "Ses kaydi LOCAL_STT_URL adresine gonderilir ve cihazdan cikmaz. Kota yoktur; C204 islenen ses suresini yerel olarak sayar.",
      en: "Audio is sent to LOCAL_STT_URL and never leaves your device. There is no quota; C204 counts processed audio seconds locally.",
    },
    quotaUnit: "audio_seconds",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: "stt.browser",
    dataLeavesDevice: "no",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "stt.browser",
    name: "Browser Speech Recognition",
    category: "stt",
    feature: "stt",
    providerKind: "browser",
    description: {
      tr: "Tarayicinin dahili ses tanima motoru (Web Speech API).",
      en: "The browser's built-in speech recognition (Web Speech API).",
    },
    details: {
      tr: "Tarayici tarafindan saglanir, API anahtari veya ucret gerektirmez. DIKKAT: bazi tarayicilar (orn. Chrome) tanimayi kendi cevrimici sunucularinda yapar; bu durumda sesiniz cihazdan cikabilir ve tarayici saticisinin bildirilmeyen sinirlarina tabidir. C204 bu sinirlari gorup dogrulayamaz.",
      en: "Provided by the browser; no API key or payment. NOTE: some browsers (e.g. Chrome) run recognition on their own online servers, so audio may leave the device and is subject to undisclosed vendor limits. C204 cannot read or verify those limits.",
    },
    quotaUnit: "audio_seconds",
    limitPeriod: "unknown",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: null,
    dataLeavesDevice: "possible",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "tts.local",
    name: "Local TTS server",
    category: "tts",
    feature: "tts",
    providerKind: "local",
    description: {
      tr: "Kendi bilgisayarinizdaki ses sentezi sunucusu.",
      en: "Your own speech synthesis server.",
    },
    details: {
      tr: "Metin LOCAL_TTS_URL adresine gonderilir ve cihazdan cikmaz. Kota yoktur; C204 sentezlenen karakter sayisini yerel olarak sayar.",
      en: "Text is sent to LOCAL_TTS_URL and never leaves your device. There is no quota; C204 counts synthesized characters locally.",
    },
    quotaUnit: "characters",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: "tts.browser",
    dataLeavesDevice: "no",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "tts.browser",
    name: "Browser Speech Synthesis",
    category: "tts",
    feature: "tts",
    providerKind: "browser",
    description: {
      tr: "Tarayicinin dahili sesleri (SpeechSynthesis) — gecici onizleme yedegi.",
      en: "The browser's built-in voices (SpeechSynthesis) — temporary preview fallback.",
    },
    details: {
      tr: "Yerel TTS sunucusu kapaliyken arayuzun sessiz kalmamasi icin kullanilir. Ucretsizdir, kota tuketmez; ses kalitesi tarayiciya baglidir. Bazi isletim sistemlerinde sesler bulut uzerinden gelebilir.",
      en: "Used so the interface is not silent while the local TTS server is down. Free and quota-free; voice quality depends on the browser. On some systems voices may be cloud-backed.",
    },
    quotaUnit: "characters",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: null,
    dataLeavesDevice: "possible",
    toggleable: true,
    defaultEnabled: true,
  },
  {
    id: "memory.embeddings",
    name: "C204 local embeddings",
    category: "embedding",
    feature: "memory",
    providerKind: "local",
    description: {
      tr: "Uygulama icinde calisan vektorlestirme (hashing + kosinus benzerligi).",
      en: "In-process vectorizer (hashing + cosine similarity).",
    },
    details: {
      tr: "Hafiza aramasinda kullanilir. Hicbir kutuphane indirmez, ag cagrisi yapmaz, API anahtari istemez. Her istekte tum hafiza degil yalnizca en alakali kayitlar cekilir.",
      en: "Used for memory retrieval. It downloads nothing, makes no network calls and needs no API key. Only the most relevant records are retrieved, never the whole memory.",
    },
    quotaUnit: "requests",
    limitPeriod: "none",
    officialLimit: null,
    supportsUsageReporting: true,
    supportsOfficialQuotaReporting: false,
    usageTrackingMode: "local",
    fallbackProviderId: null,
    dataLeavesDevice: "no",
    toggleable: false,
    defaultEnabled: true,
  },
];

export function getService(id: string): ServiceDefinition | undefined {
  return SERVICES.find((service) => service.id === id);
}

export function servicesForFeature(feature: string): ServiceDefinition[] {
  return SERVICES.filter((service) => service.feature === feature);
}
