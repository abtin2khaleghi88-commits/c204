/**
 * ============================================================================
 * KULLANIM OLCERI / USAGE METER  —  TEK MERKEZI SAYIM NOKTASI
 * ============================================================================
 * Kullanim SADECE burada kaydedilir (`recordUsage`). UI bilesenleri asla
 * kendi kendine sayac tutmaz.
 *
 * Veriler tarayicinin localStorage'inda durur: sayfa yenilemesinden sonra
 * korunur, hicbir yere gonderilmez.
 *
 * Gunluk donem: yerel gece yarisi. Aylik donem: ayin 1'i.
 * ============================================================================
 */

import { SERVICES, getService } from "./registry";
import type { FeatureId, ProviderMode, QuotaUnit, UsageSnapshot } from "./types";

const STORAGE_KEY = "c204.usage.v1";
const EVENT = "c204-usage-changed";

export type ServiceState = {
  enabled: boolean;
  /** Kullanicinin planlama icin girdigi TAHMINI limit (resmi kota degil). */
  manualDailyLimit: number | null;
  manualMonthlyLimit: number | null;
  /** Elle girilen limite ulasilinca saglayici gercekten durdurulsun mu? */
  enforce: boolean;
  daily: { periodStart: string; used: number };
  monthly: { periodStart: string; used: number };
  lastUpdated: string | null;
};

export type UsageState = {
  /** Yetenek acik/kapali (saglayicidan bagimsiz). */
  features: Record<FeatureId, boolean>;
  /** Saglayici secim bicimi. */
  modes: Record<FeatureId, ProviderMode>;
  /** modes = "manual" oldugunda kullanilacak saglayici. */
  manualProvider: Partial<Record<FeatureId, string>>;
  services: Record<string, ServiceState>;
};

function dayStart(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function monthStart(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

export function dayEnd(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}

export function monthEnd(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function freshServiceState(enabled: boolean): ServiceState {
  return {
    enabled,
    manualDailyLimit: null,
    manualMonthlyLimit: null,
    enforce: true,
    daily: { periodStart: dayStart(), used: 0 },
    monthly: { periodStart: monthStart(), used: 0 },
    lastUpdated: null,
  };
}

export function defaultUsageState(): UsageState {
  const services: Record<string, ServiceState> = {};
  for (const service of SERVICES) services[service.id] = freshServiceState(service.defaultEnabled);
  return {
    features: { ai: true, stt: true, tts: true },
    modes: { ai: "auto", stt: "auto", tts: "auto" },
    manualProvider: {},
    services,
  };
}

/** Donem degistiyse sayaclari sifirla (gunluk/aylik reset). */
function rollPeriods(state: UsageState): UsageState {
  const today = dayStart();
  const month = monthStart();
  for (const id of Object.keys(state.services)) {
    const entry = state.services[id]!;
    if (entry.daily.periodStart !== today) entry.daily = { periodStart: today, used: 0 };
    if (entry.monthly.periodStart !== month) entry.monthly = { periodStart: month, used: 0 };
  }
  return state;
}

let cache: UsageState | null = null;

export function loadUsageState(): UsageState {
  if (typeof window === "undefined") return defaultUsageState();
  if (cache) return rollPeriods(cache);
  const base = defaultUsageState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UsageState>;
      base.features = { ...base.features, ...(parsed.features ?? {}) };
      base.modes = { ...base.modes, ...(parsed.modes ?? {}) };
      base.manualProvider = { ...(parsed.manualProvider ?? {}) };
      for (const id of Object.keys(base.services)) {
        const stored = parsed.services?.[id];
        if (stored) base.services[id] = { ...base.services[id]!, ...stored };
      }
    }
  } catch {
    /* bozuk kayit — varsayilanla devam */
  }
  cache = rollPeriods(base);
  return cache;
}

export function saveUsageState(next: UsageState): void {
  cache = next;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function updateUsageState(mutator: (state: UsageState) => void): UsageState {
  const state = structuredClone(loadUsageState());
  mutator(state);
  saveUsageState(state);
  return state;
}

export function subscribeUsage(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/* ==========================================================================
 * SAYIM / RECORDING
 * ========================================================================== */

/**
 * Bir saglayici gercekten kullanildiginda cagrilir. `amount` saglayicinin
 * kota birimindedir (karakter, saniye, istek...). Ayni birim registry'de
 * `quotaUnit` olarak tanimlidir.
 */
export function recordUsage(serviceId: string, amount = 1): void {
  if (amount <= 0) return;
  updateUsageState((state) => {
    const entry = state.services[serviceId] ?? freshServiceState(true);
    entry.daily.used += amount;
    entry.monthly.used += amount;
    entry.lastUpdated = new Date().toISOString();
    state.services[serviceId] = entry;
  });
}

export function resetUsage(serviceId: string): void {
  updateUsageState((state) => {
    state.services[serviceId] = freshServiceState(state.services[serviceId]?.enabled ?? true);
  });
}

/* ==========================================================================
 * SORGULAR / QUERIES
 * ========================================================================== */

export function isServiceEnabled(serviceId: string, state = loadUsageState()): boolean {
  return state.services[serviceId]?.enabled ?? true;
}

export type UsageVerdict =
  | { allowed: true }
  | { allowed: false; reason: "manual_limit_reached"; period: "daily" | "monthly" };

/** Elle yapilandirilmis limit doldu mu? (Resmi kota degil — yerel zorlama.) */
export function checkUsageAllowed(serviceId: string, state = loadUsageState()): UsageVerdict {
  const entry = state.services[serviceId];
  if (!entry || !entry.enforce) return { allowed: true };
  if (entry.manualDailyLimit && entry.daily.used >= entry.manualDailyLimit) {
    return { allowed: false, reason: "manual_limit_reached", period: "daily" };
  }
  if (entry.manualMonthlyLimit && entry.monthly.used >= entry.manualMonthlyLimit) {
    return { allowed: false, reason: "manual_limit_reached", period: "monthly" };
  }
  return { allowed: true };
}

export function unitOf(serviceId: string): QuotaUnit {
  return getService(serviceId)?.quotaUnit ?? "unknown";
}

export function snapshots(serviceId: string, state = loadUsageState()): UsageSnapshot[] {
  const definition = getService(serviceId);
  const entry = state.services[serviceId];
  if (!definition || !entry) return [];

  const build = (period: "daily" | "monthly"): UsageSnapshot => {
    const isDaily = period === "daily";
    const used = isDaily ? entry.daily.used : entry.monthly.used;
    const manual = isDaily ? entry.manualDailyLimit : entry.manualMonthlyLimit;
    const official = definition.officialLimit;
    const limit = official ?? manual ?? null;
    return {
      serviceId,
      period,
      periodStart: isDaily ? entry.daily.periodStart : entry.monthly.periodStart,
      periodEnd: isDaily ? dayEnd() : monthEnd(),
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unit: definition.quotaUnit,
      source: official !== null ? "official" : manual !== null ? "manual" : "local",
      lastUpdated: entry.lastUpdated,
    };
  };

  return [build("daily"), build("monthly")];
}

export type WarningLevel = "normal" | "notice" | "warning" | "critical" | "exhausted";

export function warningLevel(serviceId: string, state = loadUsageState()): WarningLevel {
  let worst: WarningLevel = "normal";
  const order: WarningLevel[] = ["normal", "notice", "warning", "critical", "exhausted"];
  for (const snapshot of snapshots(serviceId, state)) {
    if (!snapshot.limit) continue;
    const ratio = snapshot.used / snapshot.limit;
    const level: WarningLevel =
      ratio >= 1 ? "exhausted" : ratio >= 0.9 ? "critical" : ratio >= 0.75 ? "warning" : ratio >= 0.5 ? "notice" : "normal";
    if (order.indexOf(level) > order.indexOf(worst)) worst = level;
  }
  return worst;
}
