/**
 * ============================================================================
 * SERVIS / SAGLAYICI SOZLESMELERI  —  SERVICE & PROVIDER CONTRACTS
 * ============================================================================
 * C204'un kullandigi her dis (veya potansiyel olarak sinirli) servis burada
 * tanimlanir. Kullanim panosu (Usage & Limits) SADECE bu meta veriyi ve
 * gercek olcumleri okur; hicbir kota degeri UI icine gomulmez.
 *
 * ONEMLI DURUSTLUK KURALI:
 *   Bir saglayici gercek kotasini API ile bildirmiyorsa `officialLimit` NULL
 *   kalir ve UI "bilinmiyor" der. Kullanicinin elle girdigi limit her zaman
 *   "user-configured estimate" olarak isaretlenir.
 * ============================================================================
 */

export type ProviderKind = "local" | "browser" | "online" | "hybrid" | "unknown";

export type QuotaUnit =
  | "requests"
  | "tokens"
  | "characters"
  | "audio_seconds"
  | "audio_minutes"
  | "bytes"
  | "credits"
  | "generic"
  | "unknown";

export type LimitPeriod = "daily" | "monthly" | "rolling" | "per_request" | "none" | "unknown";

export type ServiceCategory = "ai" | "stt" | "tts" | "embedding" | "storage" | "other";

export type UsageTrackingMode = "official" | "local" | "manual" | "unavailable";

/** Kullanicinin bir yetenek icin saglayici secme bicimi. */
export type ProviderMode = "auto" | "local_only" | "manual";

export type FeatureId = "ai" | "stt" | "tts";

export type ServiceDefinition = {
  id: string;
  name: string;
  category: ServiceCategory;
  feature: FeatureId | "memory";
  providerKind: ProviderKind;
  /** TR ve EN kisa aciklama */
  description: { tr: string; en: string };
  /** Detay panelinde gosterilen "neden kullaniliyor / ne sayilir" bilgisi */
  details: { tr: string; en: string };
  quotaUnit: QuotaUnit;
  limitPeriod: LimitPeriod;
  /** Saglayicidan dogrulanmis resmi limit. Dogrulanamiyorsa null. */
  officialLimit: number | null;
  supportsUsageReporting: boolean;
  supportsOfficialQuotaReporting: boolean;
  usageTrackingMode: UsageTrackingMode;
  /** Bu saglayici kapali/erisilemez oldugunda denenecek saglayici. */
  fallbackProviderId: string | null;
  /** Veriler cihazdan cikiyor mu? Panoda net gosterilir. */
  dataLeavesDevice: "no" | "possible" | "yes";
  /** Kullanici bu saglayiciyi kapatabilir mi? */
  toggleable: boolean;
  /** Varsayilan acik/kapali durumu */
  defaultEnabled: boolean;
};

export type ServiceAvailability =
  | "available"
  | "unavailable"
  | "not_configured"
  | "disabled"
  | "quota_exhausted"
  | "unknown";

export type UsageSnapshot = {
  serviceId: string;
  period: "daily" | "monthly";
  periodStart: string;
  periodEnd: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  unit: QuotaUnit;
  /** Verinin kaynagi — asla "official" gibi gosterilmez, gercekten oyle olmadikca. */
  source: "official" | "local" | "manual" | "estimated" | "unavailable";
  lastUpdated: string | null;
};
