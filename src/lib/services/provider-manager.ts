/**
 * ============================================================================
 * SAGLAYICI YONETICISI / PROVIDER MANAGER
 * ============================================================================
 * Akis:
 *   Istek -> yetenek acik mi? -> saglayici acik mi? -> yapilandirilmis mi?
 *         -> erisilebilir mi? -> kullanim izni var mi? -> calistir -> sayim
 *
 * UI bilesenleri asla dogrudan bir saglayiciyi cagirmaz; once buradan izin
 * alinir. Kapali bir saglayici HICBIR kosulda cagrilmaz.
 * ============================================================================
 */

import { getService, servicesForFeature } from "./registry";
import { checkUsageAllowed, loadUsageState, type UsageState } from "./usage-store";
import type { FeatureId, ServiceAvailability } from "./types";

/** Backend'in bildirdigi erisilebilirlik haritasi (servis id -> durum). */
export type AvailabilityMap = Partial<Record<string, ServiceAvailability>>;

export type Selection =
  | { ok: true; serviceId: string; fellBack: boolean; preferredId: string }
  | {
      ok: false;
      reason:
        | "feature_disabled"
        | "no_provider_enabled"
        | "provider_disabled"
        | "provider_unavailable"
        | "provider_not_configured"
        | "limit_reached";
      /** Kullaniciya aciklamak icin ilgili saglayici. */
      serviceId?: string;
    };

/** Tarayici saglayicilari icin istemci tarafi yetenek kontrolu. */
export function browserAvailability(): AvailabilityMap {
  if (typeof window === "undefined") return {};
  const hasSpeech =
    "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  return {
    "stt.browser": hasSpeech ? "available" : "unavailable",
    "tts.browser": "speechSynthesis" in window ? "available" : "unavailable",
    "ai.demo": "available",
    "memory.embeddings": "available",
  };
}

function candidateOrder(feature: FeatureId, state: UsageState): string[] {
  const all = servicesForFeature(feature);
  const mode = state.modes[feature];

  if (mode === "manual") {
    const chosen = state.manualProvider[feature];
    return chosen ? [chosen] : all.map((service) => service.id);
  }
  if (mode === "local_only") {
    return all
      .filter((service) => service.providerKind === "local" || service.providerKind === "browser")
      .map((service) => service.id);
  }
  // auto: yerel once, sonra kayit sirasi
  return [...all]
    .sort((a, b) => Number(b.providerKind === "local") - Number(a.providerKind === "local"))
    .map((service) => service.id);
}

/**
 * Bir yetenek icin kullanilabilecek saglayiciyi secer.
 * Hicbir saglayici uygun degilse NEDENI birlikte doner (sessiz basarisizlik yok).
 */
export function selectProvider(
  feature: FeatureId,
  availability: AvailabilityMap,
  state: UsageState = loadUsageState(),
): Selection {
  if (!state.features[feature]) return { ok: false, reason: "feature_disabled" };

  const order = candidateOrder(feature, state);
  if (order.length === 0) return { ok: false, reason: "no_provider_enabled" };

  const preferredId = order[0]!;
  let fallbackReason: Extract<Selection, { ok: false }>["reason"] = "provider_unavailable";
  let fallbackService = preferredId;

  for (const serviceId of order) {
    const definition = getService(serviceId);
    if (!definition) continue;

    if (!(state.services[serviceId]?.enabled ?? true)) {
      if (serviceId === preferredId) {
        fallbackReason = "provider_disabled";
        fallbackService = serviceId;
      }
      continue;
    }

    const status = availability[serviceId] ?? "unknown";
    if (status === "not_configured" || status === "unavailable") {
      if (serviceId === preferredId) {
        fallbackReason = status === "not_configured" ? "provider_not_configured" : "provider_unavailable";
        fallbackService = serviceId;
      }
      continue;
    }

    if (!checkUsageAllowed(serviceId, state).allowed) {
      if (serviceId === preferredId) {
        fallbackReason = "limit_reached";
        fallbackService = serviceId;
      }
      continue;
    }

    // Manual modda secilen saglayici disina KENDILIGINDEN cikilmaz.
    return { ok: true, serviceId, fellBack: serviceId !== preferredId, preferredId };
  }

  return { ok: false, reason: fallbackReason, serviceId: fallbackService };
}
