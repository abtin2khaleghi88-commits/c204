/**
 * ============================================================================
 * TTS KATMANI / TEXT-TO-SPEECH LAYER  -- TEK MERKEZI NOKTA
 * ============================================================================
 * Tum ses uretimi TEK fonksiyondan gecer: `synthesizeSpeech()`.
 * Motor secimi .env uzerinden yapilir; kod degistirmeye gerek yoktur:
 *
 *   TTS_PROVIDER=lovable | elevenlabs | azure | google | local
 *
 * Varsayilan: "lovable" (Lovable AI Gateway uzerinden noral TTS,
 * LOVABLE_API_KEY otomatik saglanir; ekstra kurulum gerekmez).
 *
 * ---------------------------------------------------------------------------
 * KENDI MOTORUNUZU BAGLAMAK ICIN: `TTS_PROVIDER=local` yapin ve
 * asagidaki `callLocalTts()` fonksiyonunun GOVDESINI kendi API'nize gore
 * degistirin. Baska hicbir dosyaya dokunmaniz gerekmez.
 * ---------------------------------------------------------------------------
 *
 * Donen deger:
 *   { audio: ArrayBuffer, contentType }  -> ham ses dosyasi (wav/mp3/ogg...)
 *   { base64: string, contentType }      -> base64 kodlu ses
 * Hata durumunda exception firlatilir (arayuz kullaniciya hata gosterir).
 * Tarayici SpeechSynthesis fallback'i KALDIRILDI.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type SynthesizeInput = { text: string; language: "tr" | "en" };

export type SynthesizeResult =
  | { audio: ArrayBuffer; contentType: string }
  | { base64: string; contentType: string };

async function fail(label: string, response: Response): Promise<never> {
  throw new Error(`${label} ${response.status}: ${(await response.text()).slice(0, 400)}`);
}

/* ==========================================================================
 * 1) LOVABLE AI GATEWAY (varsayilan demo motoru — noral, Turkce destekli)
 * ========================================================================== */
async function callLovableTts(
  cfg: { model: string; voice: string; apiKey: string },
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      voice: cfg.voice,
      input: input.text,
      response_format: "mp3",
      instructions:
        input.language === "tr"
          ? "Turkce konus. Dogal, sicak ve akici bir tonda, normal konusma hizinda oku."
          : "Speak English in a natural, warm and fluent tone at a normal pace.",
    }),
  });
  if (!response.ok) await fail("Lovable TTS error", response);
  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

/* ==========================================================================
 * 2) ELEVENLABS  (ELEVENLABS_API_KEY + opsiyonel ELEVENLABS_VOICE_ID)
 * ========================================================================== */
async function callElevenLabsTts(
  cfg: { apiKey: string; voiceId: string; model: string },
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": cfg.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        model_id: cfg.model,
        voice_settings: { stability: 0.45, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    },
  );
  if (!response.ok) await fail("ElevenLabs TTS error", response);
  return { audio: await response.arrayBuffer(), contentType: "audio/mpeg" };
}

/* ==========================================================================
 * 3) AZURE NEURAL TTS  (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)
 * ========================================================================== */
async function callAzureTts(
  cfg: { apiKey: string; region: string; voiceTr: string; voiceEn: string },
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const locale = input.language === "tr" ? "tr-TR" : "en-US";
  const voice = input.language === "tr" ? cfg.voiceTr : cfg.voiceEn;
  const ssml =
    `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">` +
    input.text.replace(/[<>&]/g, " ") +
    `</voice></speak>`;

  const response = await fetch(
    `https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": cfg.apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      },
      body: ssml,
    },
  );
  if (!response.ok) await fail("Azure TTS error", response);
  return { audio: await response.arrayBuffer(), contentType: "audio/mpeg" };
}

/* ==========================================================================
 * 4) GOOGLE CLOUD TTS  (GOOGLE_TTS_API_KEY)
 * ========================================================================== */
async function callGoogleTts(
  cfg: { apiKey: string; voiceTr: string; voiceEn: string },
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const locale = input.language === "tr" ? "tr-TR" : "en-US";
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${cfg.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: input.text },
        voice: {
          languageCode: locale,
          name: input.language === "tr" ? cfg.voiceTr : cfg.voiceEn,
        },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );
  if (!response.ok) await fail("Google TTS error", response);
  const payload = (await response.json()) as { audioContent?: string };
  if (!payload.audioContent) throw new Error("Google TTS response has no audioContent");
  return { base64: payload.audioContent, contentType: "audio/mpeg" };
}

/* ==========================================================================
 * 5) >>> KENDI YEREL TTS MOTORUNUZU BURAYA BAGLAYIN <<<
 *    TTS_PROVIDER=local + LOCAL_TTS_URL=http://localhost:5002/api/tts
 *    Farkli govde alanlari / header / GET-POST kullaniyorsaniz sadece
 *    bu fonksiyonu degistirin.
 * ========================================================================== */
async function callLocalTts(url: string, input: SynthesizeInput): Promise<SynthesizeResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text, language: input.language }),
  });
  if (!response.ok) await fail("Local TTS error", response);

  const contentType = response.headers.get("content-type") ?? "audio/wav";

  // JSON + base64 donduren motorlar (orn. { audio: "UklGR..." })
  if (contentType.includes("json")) {
    const payload = (await response.json()) as Record<string, unknown>;
    const base64 =
      (payload["audio"] as string | undefined) ??
      (payload["audio_base64"] as string | undefined) ??
      (payload["data"] as string | undefined);
    if (!base64) throw new Error("Local TTS JSON response has no audio field");
    return {
      base64,
      contentType: (payload["contentType"] as string | undefined) ?? "audio/wav",
    };
  }

  // Ham ses (stream/binary)
  return { audio: await response.arrayBuffer(), contentType };
}

/**
 * TEK MERKEZI TTS GIRIS NOKTASI.
 * Arayuz/backend her zaman bu fonksiyonu cagirir; motor secimi .env'dedir.
 */
export async function synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeResult> {
  const { tts } = getLocalStackConfig();
  const text = input.text.trim();
  if (!text) throw new Error("TTS: empty text");

  switch (tts.provider) {
    case "elevenlabs":
      if (!tts.elevenlabs.apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
      return callElevenLabsTts({ ...tts.elevenlabs }, { ...input, text });
    case "azure":
      if (!tts.azure.apiKey) throw new Error("AZURE_SPEECH_KEY is not configured");
      return callAzureTts({ ...tts.azure }, { ...input, text });
    case "google":
      if (!tts.google.apiKey) throw new Error("GOOGLE_TTS_API_KEY is not configured");
      return callGoogleTts({ ...tts.google }, { ...input, text });
    case "local":
      if (!tts.local.url) throw new Error("LOCAL_TTS_URL is not configured");
      return callLocalTts(tts.local.url, { ...input, text });
    case "lovable":
    default:
      if (!tts.lovable.apiKey) throw new Error("LOVABLE_API_KEY is not configured");
      return callLovableTts({ ...tts.lovable }, { ...input, text });
  }
}
