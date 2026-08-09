/**
 * ============================================================================
 * TTS KATMANI / TEXT-TO-SPEECH LAYER  -- TEK MERKEZI NOKTA
 * ============================================================================
 * Bu projede UCRETLI / TOKEN BAZLI hicbir TTS saglayicisi YOKTUR.
 * (Lovable AI Gateway, OpenAI, ElevenLabs, Azure, Google -> tamamen kaldirildi.)
 *
 * Tek hedef motor: SIZIN kendi bilgisayarinizda calisan YEREL TTS sunucunuz.
 *
 *   LOCAL_TTS_URL=http://localhost:8880/synthesize   (varsayilan)
 *   LOCAL_TTS_TIMEOUT_MS=8000                        (opsiyonel)
 *
 * ---------------------------------------------------------------------------
 * BEKLENEN SOZLESME / EXPECTED CONTRACT
 *
 *   POST <LOCAL_TTS_URL>
 *   Content-Type: application/json
 *   { "text": "okunacak metin", "language": "tr" | "en" }
 *
 *   Yanit A (onerilen): ham ses baytlari
 *     Content-Type: audio/wav | audio/mpeg | audio/ogg
 *   Yanit B: application/json
 *     { "audio": "<base64>", "contentType": "audio/wav" }
 *     ("audio_base64" veya "data" alan adlari da kabul edilir)
 *
 *   Onerilen format: 16-bit PCM WAV, 22050 veya 24000 Hz, mono.
 * ---------------------------------------------------------------------------
 *
 * Kendi API sekliniz farkliysa SADECE `callLocalTts()` govdesini degistirin.
 *
 * Yerel sunucuya ULASILAMAZSA (baglanti hatasi / timeout) hata firlatilmaz;
 * `{ unavailable: true }` doner ve arayuz GECICI olarak tarayici
 * SpeechSynthesis'ine duser. Bu yalnizca onizleme kolayligidir; gercek
 * sistemde kullanilmaz.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type SynthesizeInput = { text: string; language: "tr" | "en" };

export type SynthesizeResult =
  | { audio: ArrayBuffer; contentType: string }
  | { base64: string; contentType: string }
  /** Yerel sunucu calismiyor -> onizleme yedegi devreye girsin. */
  | { unavailable: true; reason: string };

/* ==========================================================================
 * >>> KENDI YEREL TTS MOTORUNUZU BURAYA BAGLAYIN <<<
 * ========================================================================== */
async function callLocalTts(
  url: string,
  timeoutMs: number,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text, language: input.language }),
      signal: controller.signal,
    });
  } catch (error) {
    // Sunucu kapali / erisilemez -> sessiz onizleme yedegi
    return { unavailable: true, reason: `local TTS unreachable at ${url}: ${String(error)}` };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return {
      unavailable: true,
      reason: `local TTS error ${response.status}: ${(await response.text()).slice(0, 300)}`,
    };
  }

  const contentType = response.headers.get("content-type") ?? "audio/wav";

  // JSON + base64 donduren motorlar (orn. { audio: "UklGR..." })
  if (contentType.includes("json")) {
    const payload = (await response.json()) as Record<string, unknown>;
    const base64 =
      (payload["audio"] as string | undefined) ??
      (payload["audio_base64"] as string | undefined) ??
      (payload["data"] as string | undefined);
    if (!base64) {
      return { unavailable: true, reason: "local TTS JSON response has no audio field" };
    }
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
 * Arayuz/backend her zaman bu fonksiyonu cagirir.
 */
export async function synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeResult> {
  const { tts } = getLocalStackConfig();
  const text = input.text.trim();
  if (!text) throw new Error("TTS: empty text");

  return callLocalTts(tts.url, tts.timeoutMs, { ...input, text });
}
