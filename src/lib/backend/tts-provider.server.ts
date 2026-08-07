/**
 * ============================================================================
 * TTS KATMANI / TEXT-TO-SPEECH LAYER
 * ============================================================================
 * Tek cikis noktasi: `synthesizeSpeech`.
 * LOCAL_TTS_URL tanimliysa yerel TTS sunucunuza (Piper, Coqui, XTTS vb.)
 * istek atilir ve ses dosyasi dondurulur.
 * Tanimli degilse `null` doner -> istemci tarayicinin SpeechSynthesis
 * motorunu kullanir (offline, ucretsiz demo).
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type SynthesizeInput = { text: string; language: "tr" | "en" };

export async function synthesizeSpeech(
  input: SynthesizeInput,
): Promise<{ audio: ArrayBuffer; contentType: string } | null> {
  const { tts } = getLocalStackConfig();
  if (!tts.enabled) return null;

  const response = await fetch(tts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text, language: input.language }),
  });

  if (!response.ok) {
    throw new Error(`Local TTS error ${response.status}: ${await response.text()}`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/wav",
  };
}
