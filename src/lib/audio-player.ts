/**
 * ============================================================================
 * GENEL SES OYNATICI / GENERIC AUDIO PLAYER
 * ============================================================================
 * Bu modul HERHANGI bir ses kaynagini oynatir:
 *   - Blob            (fetch(...).blob())
 *   - ArrayBuffer     (ham ses baytlari)
 *   - base64 string   ("UklGR..." veya "data:audio/wav;base64,...")
 *   - Response        (stream; once tamamen okunur, sonra decode edilir)
 *
 * Hicbir TTS motoruna bagli degildir; sizin backend'inizden gelen ses
 * dosyasini oldugu gibi calar.
 *
 * Ayrica Web Audio API'nin AnalyserNode'u ile GERCEK genlik (amplitude)
 * verisi uretir -> arayuzdeki dalga animasyonu sabit bir dongu degil,
 * sesin kendisiyle senkronize calisir.
 * ============================================================================
 */

export type AudioSource = Blob | ArrayBuffer | string | Response;

export type PlaybackHandle = {
  /** Oynatmayi durdurur ve kaynaklari serbest birakir. */
  stop: () => void;
};

export type PlayOptions = {
  /** Her animasyon karesinde 0..1 arasi bant seviyeleri (varsayilan 9 bant). */
  onLevels?: (levels: number[]) => void;
  /** Ses bittiginde veya durduruldugunda cagrilir. */
  onEnded?: () => void;
  /** Kac frekans bandi uretilecegi. */
  bands?: number;
};

const BANDS = 9;

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const raw = value.includes(",") && value.startsWith("data:") ? value.split(",")[1]! : value;
  const binary = atob(raw.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function toArrayBuffer(source: AudioSource): Promise<ArrayBuffer> {
  if (typeof source === "string") return base64ToArrayBuffer(source);
  if (source instanceof ArrayBuffer) return source;
  if (typeof Response !== "undefined" && source instanceof Response) {
    return await source.arrayBuffer();
  }
  return await (source as Blob).arrayBuffer();
}

/**
 * Herhangi bir ses kaynagini calar ve gercek genlige bagli seviye verisi yayar.
 */
export async function playAudioSource(
  source: AudioSource,
  options: PlayOptions = {},
): Promise<PlaybackHandle> {
  const bands = options.bands ?? BANDS;
  const buffer = await toArrayBuffer(source);

  const ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  const decoded = await ctx.decodeAudioData(buffer.slice(0));

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;

  const node = ctx.createBufferSource();
  node.buffer = decoded;
  node.connect(analyser);
  analyser.connect(ctx.destination);

  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;
  let stopped = false;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    try {
      node.stop();
    } catch {
      /* zaten durmus */
    }
    node.disconnect();
    analyser.disconnect();
    void ctx.close().catch(() => {});
    options.onLevels?.(new Array(bands).fill(0));
    options.onEnded?.();
  };

  const tick = () => {
    if (stopped) return;
    analyser.getByteFrequencyData(spectrum);
    // Dusuk frekanslara agirlik veren logaritmik bant bolumlemesi
    const usable = Math.floor(spectrum.length * 0.6);
    const levels: number[] = [];
    for (let b = 0; b < bands; b++) {
      const start = Math.floor((usable * b) / bands);
      const end = Math.max(start + 1, Math.floor((usable * (b + 1)) / bands));
      let sum = 0;
      for (let i = start; i < end; i++) sum += spectrum[i]!;
      levels.push(Math.min(1, sum / (end - start) / 190));
    }
    options.onLevels?.(levels);
    frame = requestAnimationFrame(tick);
  };

  node.onended = finish;
  node.start();
  frame = requestAnimationFrame(tick);

  return { stop: finish };
}

/**
 * Yerel TTS motoru henuz baglanmadiginda kullanilan tarayici fallback'i.
 * SpeechSynthesis ham ses verisi vermedigi icin seviye verisi analiz
 * edilemez; kaba bir yaklasik seviye uretilir. Kendi motorunuzu
 * bagladiginizda bu yol hic calismaz.
 */
export function playBrowserSpeech(
  text: string,
  lang: string,
  options: PlayOptions = {},
): PlaybackHandle {
  const bands = options.bands ?? BANDS;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onEnded?.();
    return { stop: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  let frame = 0;
  let stopped = false;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.speechSynthesis.cancel();
    options.onLevels?.(new Array(bands).fill(0));
    options.onEnded?.();
  };

  const tick = () => {
    if (stopped) return;
    const now = performance.now() / 1000;
    const levels = Array.from({ length: bands }, (_, i) => {
      const v = 0.35 + 0.35 * Math.sin(now * 7 + i * 0.9) * Math.sin(now * 2.3 + i);
      return Math.max(0.05, Math.min(1, v));
    });
    options.onLevels?.(levels);
    frame = requestAnimationFrame(tick);
  };

  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  frame = requestAnimationFrame(tick);

  return { stop: finish };
}
