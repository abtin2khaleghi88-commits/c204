/**
 * ============================================================================
 * SES YETENEK DENETLEYICISI / VOICE FEATURE CONTROLLER
 * ============================================================================
 * Akis:  istek -> selectProvider() -> saglayiciyi calistir -> recordUsage()
 *
 * Buradaki kural: KAPALI bir saglayici asla cagrilmaz, sessizce baska bir
 * saglayiciya gecilmez (yalnizca "auto" modda ve sebebi bildirilerek gecilir).
 * ============================================================================
 */

import {
  fetchServiceStatus,
  speakWithBrowser,
  speakWithLocalServer,
  type Language,
} from "@/lib/assistant-client";
import type { PlaybackHandle } from "@/lib/audio-player";

import { browserAvailability, selectProvider, type AvailabilityMap, type Selection } from "./provider-manager";
import { loadUsageState, recordUsage } from "./usage-store";

/** Yerel uclarin durumu + tarayici yetenekleri. `probe` gercek baglanti dener. */
export async function loadAvailability(probe = false): Promise<AvailabilityMap> {
  const browser = browserAvailability();
  try {
    const status = await fetchServiceStatus(probe);
    return { ...browser, ...status.availability } as AvailabilityMap;
  } catch {
    return browser;
  }
}

export type SpeakOutcome =
  | { ok: true; serviceId: string; handle: PlaybackHandle; fellBack: boolean }
  | { ok: false; reason: Extract<Selection, { ok: false }>["reason"]; serviceId?: string };

/** TTS: saglayici sec, calistir, karakter bazinda kullanim kaydet. */
export async function speakViaProviders(
  text: string,
  language: Language,
  availability: AvailabilityMap,
  handlers: { onLevels?: (levels: number[]) => void; onEnded?: () => void } = {},
): Promise<SpeakOutcome> {
  const state = loadUsageState();
  let map = availability;
  let selection = selectProvider("tts", map, state);
  if (!selection.ok) return selection;

  if (selection.serviceId === "tts.local") {
    try {
      const handle = await speakWithLocalServer(text, language, handlers);
      if (handle) {
        recordUsage("tts.local", text.length);
        return { ok: true, serviceId: "tts.local", handle, fellBack: selection.fellBack };
      }
    } catch {
      /* erisilemez — yedege bakilir */
    }
    // Yerel sunucu erisilemez: yalnizca izin verilen yedege gecilir.
    map = { ...map, "tts.local": "unavailable" };
    selection = selectProvider("tts", map, state);
    if (!selection.ok) return selection;
  }

  if (selection.serviceId === "tts.browser") {
    const handle = speakWithBrowser(text, language, handlers);
    recordUsage("tts.browser", text.length);
    return { ok: true, serviceId: "tts.browser", handle, fellBack: true };
  }

  return { ok: false, reason: "provider_unavailable", serviceId: selection.serviceId };
}

/** STT: hangi motorlarin kullanilmasina izin verildigini belirler. */
export function planStt(availability: AvailabilityMap): {
  allowLocal: boolean;
  allowBrowser: boolean;
  selection: Selection;
} {
  const state = loadUsageState();
  const selection = selectProvider("stt", availability, state);

  // Yetenek kapali -> hicbir motor calistirilmaz (mikrofon bile acilmaz).
  if (!state.features.stt) {
    return { allowLocal: false, allowBrowser: false, selection };
  }

  const manual = state.modes.stt === "manual";
  const picked = state.manualProvider.stt;

  const localOk =
    (state.services["stt.local"]?.enabled ?? true) &&
    availability["stt.local"] !== "not_configured" &&
    (!manual || picked === "stt.local");

  const browserOk =
    (state.services["stt.browser"]?.enabled ?? true) &&
    availability["stt.browser"] !== "unavailable" &&
    availability["stt.browser"] !== "not_configured" &&
    state.modes.stt !== "local_only" &&
    (!manual || picked === "stt.browser");

  return { allowLocal: Boolean(localOk), allowBrowser: Boolean(browserOk), selection };
}

/** STT kullanimini (islenen ses saniyesi) kaydeder. */
export function recordSttUsage(serviceId: string, seconds: number): void {
  recordUsage(serviceId, Math.max(1, Math.round(seconds)));
}

/** AI kullanimini (istek sayisi) kaydeder. */
export function recordAiUsage(source: "local" | "mock"): void {
  recordUsage(source === "local" ? "ai.ollama" : "ai.demo", 1);
}

/** Hafiza vektorlestirme cagrisini kaydeder. */
export function recordMemoryUsage(): void {
  recordUsage("memory.embeddings", 1);
}
