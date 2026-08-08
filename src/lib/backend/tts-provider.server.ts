/**
 * ============================================================================
 * TTS KATMANI / TEXT-TO-SPEECH LAYER  -- TEK MERKEZI NOKTA
 * ============================================================================
 * Tum ses uretimi TEK fonksiyondan gecer: `synthesizeSpeech()`.
 * Kendi TTS motorunuzu baglamak icin SADECE bu dosyadaki `callLocalTts()`
 * govdesini degistirin; baska hicbir dosyaya dokunmaniz gerekmez.
 *
 * .env ile ayarlanir (src/config/local-stack.config.ts uzerinden):
 *   LOCAL_TTS_URL=http://localhost:5002/api/tts
 *
 * Donen deger:
 *   { audio: ArrayBuffer, contentType }  -> ham ses dosyasi (wav/mp3/ogg...)
 *   { base64: string, contentType }      -> base64 kodlu ses
 *   null                                 -> yerel TTS yok; istemci tarayici
 *                                           sesini (fallback) kullanir
 * Istemci tarafindaki oynatici (src/lib/audio-player.ts) her ucunu da oynatir.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type SynthesizeInput = { text: string; language: "tr" | "en" };

export type SynthesizeResult =
  | { audio: ArrayBuffer; contentType: string }
  | { base64: string; contentType: string };

/**
 * >>> KENDI TTS MOTORUNUZU BURAYA BAGLAYIN <<<
 * Farkli bir API sekliniz varsa (govde alanlari, header'lar, GET/POST)
 * yalnizca bu fonksiyonu degistirin.
 */
async function callLocalTts(
  url: string,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text, language: input.language }),
  });

  if (!response.ok) {
    throw new Error(`Local TTS error ${response.status}: ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") ?? "audio/wav";

  // 1) JSON + base64 donduren motorlar (orn. { audio: "UklGR..." })
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

  // 2) Ham ses (stream/binary) donduren motorlar
  return { audio: await response.arrayBuffer(), contentType };
}

export async function synthesizeSpeech(
  input: SynthesizeInput,
): Promise<SynthesizeResult | null> {
  const { tts } = getLocalStackConfig();
  if (!tts.enabled) return null;
  return callLocalTts(tts.url, input);
}
