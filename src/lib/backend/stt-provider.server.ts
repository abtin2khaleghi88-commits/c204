/**
 * ============================================================================
 * STT KATMANI / SPEECH-TO-TEXT LAYER  -- TEK MERKEZI NOKTA
 * ============================================================================
 * Bu projede UCRETLI / TOKEN BAZLI hicbir STT saglayicisi YOKTUR.
 * (OpenAI Whisper API, Google Speech-to-Text, Azure, Deepgram -> yok.)
 *
 * Tek hedef motor: SIZIN kendi bilgisayarinizda calisan YEREL Whisper
 * (veya whisper.cpp / faster-whisper) sunucunuz.
 *
 *   LOCAL_STT_URL=http://localhost:9000/transcribe   (varsayilan)
 *   LOCAL_STT_TIMEOUT_MS=15000                       (opsiyonel)
 *
 * ---------------------------------------------------------------------------
 * BEKLENEN SOZLESME / EXPECTED CONTRACT
 *
 *   POST <LOCAL_STT_URL>
 *   Content-Type: multipart/form-data
 *     file      = ses dosyasi (audio/webm | audio/wav | audio/ogg)
 *     language  = "tr" | "en"
 *
 *   Yanit: application/json
 *     { "text": "cozumlenen metin" }
 *     ("transcript", "transcription" veya { "result": { "text": ... } } da kabul edilir)
 *
 *   Onerilen giris formati: 16 kHz mono WAV veya tarayicidan gelen webm/opus.
 * ---------------------------------------------------------------------------
 *
 * Kendi API sekliniz farkliysa SADECE `callLocalStt()` govdesini degistirin.
 *
 * Yerel sunucuya ULASILAMAZSA hata firlatilmaz; `{ unavailable: true }` doner
 * ve arayuz GECICI olarak tarayici SpeechRecognition sonucuna duser
 * (TTS'teki `previewFallbackSpeak()` ile ayni mantik). Bu yalnizca
 * gelistirme/onizleme kolayligidir; gercek sistemde kullanilmaz.
 * ============================================================================
 */

import { getLocalStackConfig } from "@/config/local-stack.config";

export type TranscribeInput = {
  /** Ses verisi (base64, data URL prefix'i olmadan) */
  audioBase64: string;
  /** Orn. "audio/webm" */
  mimeType: string;
  language: "tr" | "en";
};

export type TranscribeResult =
  | { text: string }
  /** Yerel sunucu calismiyor -> onizleme yedegi devreye girsin. */
  | { unavailable: true; reason: string };

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/* ==========================================================================
 * >>> KENDI YEREL STT (WHISPER) MOTORUNUZU BURAYA BAGLAYIN <<<
 * ========================================================================== */
async function callLocalStt(
  url: string,
  timeoutMs: number,
  input: TranscribeInput,
): Promise<TranscribeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const extension = input.mimeType.includes("wav")
    ? "wav"
    : input.mimeType.includes("ogg")
      ? "ogg"
      : "webm";

  const form = new FormData();
  form.append(
    "file",
    new Blob([base64ToBytes(input.audioBase64) as unknown as BlobPart], { type: input.mimeType }),
    `speech.${extension}`,
  );
  form.append("language", input.language);

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: form, signal: controller.signal });
  } catch (error) {
    return { unavailable: true, reason: `local STT unreachable at ${url}: ${String(error)}` };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return {
      unavailable: true,
      reason: `local STT error ${response.status}: ${(await response.text()).slice(0, 300)}`,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const nested = (payload["result"] ?? {}) as Record<string, unknown>;
  const text =
    (payload["text"] as string | undefined) ??
    (payload["transcript"] as string | undefined) ??
    (payload["transcription"] as string | undefined) ??
    (nested["text"] as string | undefined);

  if (typeof text !== "string") {
    return { unavailable: true, reason: "local STT JSON response has no text field" };
  }
  return { text: text.trim() };
}

/**
 * TEK MERKEZI STT GIRIS NOKTASI.
 * Arayuz/backend her zaman bu fonksiyonu cagirir.
 */
export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  const { stt } = getLocalStackConfig();
  if (!input.audioBase64) return { unavailable: true, reason: "STT: empty audio" };
  return callLocalStt(stt.url, stt.timeoutMs, input);
}
