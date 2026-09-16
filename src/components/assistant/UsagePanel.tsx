/**
 * ============================================================================
 * KULLANIM & LIMITLER PANOSU / USAGE & LIMITS DASHBOARD
 * ============================================================================
 * Servis meta verisi `src/lib/services/registry.ts`, olcumler
 * `src/lib/services/usage-store.ts` uzerinden gelir. Hicbir kota degeri
 * bu bilesende sabit yazilmaz. Resmi kota bilinmiyorsa "bilinmiyor" denir.
 * ============================================================================
 */

import { Activity, ChevronDown, Cpu, Globe, Info, Laptop, Mic, RotateCcw, Volume2, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Language } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";
import type { AvailabilityMap } from "@/lib/services/provider-manager";
import { SERVICES } from "@/lib/services/registry";
import type { FeatureId, ProviderMode, QuotaUnit, ServiceDefinition } from "@/lib/services/types";
import {
  loadUsageState,
  resetUsage,
  snapshots,
  subscribeUsage,
  updateUsageState,
  warningLevel,
  type UsageState,
} from "@/lib/services/usage-store";

type Props = {
  language: Language;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availability: AvailabilityMap;
  onRefresh: () => Promise<void> | void;
};

const KIND_ICON = {
  local: Laptop,
  browser: Globe,
  online: Globe,
  hybrid: Waves,
  unknown: Info,
} as const;

const FEATURE_ICON = { ai: Cpu, stt: Mic, tts: Volume2 } as const;

function unitLabel(language: Language, unit: QuotaUnit): string {
  const tr: Record<QuotaUnit, string> = {
    requests: "istek",
    tokens: "token",
    characters: "karakter",
    audio_seconds: "ses saniyesi",
    audio_minutes: "ses dakikasi",
    bytes: "bayt",
    credits: "kredi",
    generic: "birim",
    unknown: "bilinmiyor",
  };
  const en: Record<QuotaUnit, string> = {
    requests: "requests",
    tokens: "tokens",
    characters: "characters",
    audio_seconds: "audio seconds",
    audio_minutes: "audio minutes",
    bytes: "bytes",
    credits: "credits",
    generic: "units",
    unknown: "unknown",
  };
  return language === "tr" ? tr[unit] : en[unit];
}

function formatTime(language: Language, iso: string | null): string {
  if (!iso) return language === "tr" ? "henuz yok" : "not yet";
  return new Date(iso).toLocaleString(language === "tr" ? "tr-TR" : "en-US");
}

export function UsagePanel({ language, open, onOpenChange, availability, onRefresh }: Props) {
  const [state, setState] = useState<UsageState>(() => loadUsageState());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => subscribeUsage(() => setState(loadUsageState())), []);
  useEffect(() => {
    if (open) setState(loadUsageState());
  }, [open]);

  const statusOf = (service: ServiceDefinition) => {
    const entry = state.services[service.id];
    if (!state.features[service.feature as FeatureId] && service.feature !== "memory") {
      return { key: "featureOff", tone: "muted" } as const;
    }
    if (entry && !entry.enabled) return { key: "statusDisabled", tone: "muted" } as const;
    const level = warningLevel(service.id, state);
    if (level === "exhausted") return { key: "statusLimitReached", tone: "danger" } as const;
    const availabilityValue = availability[service.id] ?? "unknown";
    if (availabilityValue === "not_configured") return { key: "statusNotConfigured", tone: "muted" } as const;
    if (availabilityValue === "unavailable") return { key: "statusUnavailable", tone: "danger" } as const;
    if (availabilityValue === "unknown") return { key: "statusUnknown", tone: "muted" } as const;
    return { key: "statusAvailable", tone: "ok" } as const;
  };

  const summary = useMemo(() => {
    let active = 0;
    let disabled = 0;
    let unavailable = 0;
    let localOnly = 0;
    let limited = 0;
    for (const service of SERVICES) {
      const status = statusOf(service);
      if (status.key === "statusAvailable") active += 1;
      if (status.key === "statusDisabled" || status.key === "featureOff") disabled += 1;
      if (status.key === "statusUnavailable" || status.key === "statusNotConfigured") unavailable += 1;
      if (service.providerKind === "local") localOnly += 1;
      const entry = state.services[service.id];
      if (entry?.manualDailyLimit || entry?.manualMonthlyLimit || service.officialLimit) limited += 1;
    }
    return { active, disabled, unavailable, localOnly, limited };
  }, [state, availability]);

  const setFeature = (feature: FeatureId, value: boolean) =>
    updateUsageState((next) => {
      next.features[feature] = value;
    });

  const setMode = (feature: FeatureId, mode: ProviderMode) =>
    updateUsageState((next) => {
      next.modes[feature] = mode;
    });

  const setManualProvider = (feature: FeatureId, id: string) =>
    updateUsageState((next) => {
      next.manualProvider[feature] = id;
    });

  const setEnabled = (serviceId: string, value: boolean) =>
    updateUsageState((next) => {
      const entry = next.services[serviceId];
      if (entry) entry.enabled = value;
    });

  const setLimit = (serviceId: string, period: "daily" | "monthly", value: string) =>
    updateUsageState((next) => {
      const entry = next.services[serviceId];
      if (!entry) return;
      const parsed = value.trim() === "" ? null : Math.max(0, Number(value));
      const limit = parsed !== null && Number.isFinite(parsed) ? parsed : null;
      if (period === "daily") entry.manualDailyLimit = limit;
      else entry.manualMonthlyLimit = limit;
    });

  const setEnforce = (serviceId: string, value: boolean) =>
    updateUsageState((next) => {
      const entry = next.services[serviceId];
      if (entry) entry.enforce = value;
    });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {t(language, "usagePanel")}
          </DialogTitle>
          <DialogDescription>{t(language, "usageSubtitle")}</DialogDescription>
        </DialogHeader>

        {/* OZET */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: t(language, "sumActive"), value: summary.active },
            { label: t(language, "sumDisabled"), value: summary.disabled },
            { label: t(language, "sumUnavailable"), value: summary.unavailable },
            { label: t(language, "sumLocal"), value: summary.localOnly },
            { label: t(language, "sumLimited"), value: summary.limited },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 backdrop-blur-sm"
            >
              <p className="hud-title text-lg font-semibold text-primary">{item.value}</p>
              <p className="hud-text text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="hud-text text-[10px] text-muted-foreground opacity-80">
            {t(language, "honestyNote")}
          </p>
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => void refresh()}>
            <RotateCcw className={"mr-1.5 h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
            {t(language, "checkNow")}
          </Button>
        </div>

        {/* YETENEK KONTROLLERI (saglayicidan bagimsiz) */}
        <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/10 p-3">
          <p className="hud-title text-[11px] font-semibold">{t(language, "featureControls")}</p>
          {(["ai", "stt", "tts"] as FeatureId[]).map((feature) => {
            const Icon = FEATURE_ICON[feature];
            const providers = SERVICES.filter((service) => service.feature === feature);
            return (
              <div key={feature} className="space-y-2 rounded-xl border border-border/50 p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-center gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {t(language, feature === "ai" ? "featureAi" : feature === "stt" ? "featureStt" : "featureTts")}
                  </Label>
                  <Switch
                    checked={state.features[feature]}
                    onCheckedChange={(checked) => setFeature(feature, checked)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["auto", "local_only", "manual"] as ProviderMode[]).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={state.modes[feature] === mode ? "default" : "secondary"}
                      className="hud-text rounded-full px-3 text-[10px]"
                      onClick={() => setMode(feature, mode)}
                    >
                      {t(
                        language,
                        mode === "auto" ? "modeAuto" : mode === "local_only" ? "modeLocalOnly" : "modeManual",
                      )}
                    </Button>
                  ))}
                  {state.modes[feature] === "manual" &&
                    providers.map((provider) => (
                      <Button
                        key={provider.id}
                        size="sm"
                        variant={state.manualProvider[feature] === provider.id ? "default" : "ghost"}
                        className="hud-text rounded-full px-3 text-[10px]"
                        onClick={() => setManualProvider(feature, provider.id)}
                      >
                        {provider.name}
                      </Button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* SERVIS KARTLARI */}
        <div className="space-y-2">
          {SERVICES.map((service) => {
            const entry = state.services[service.id]!;
            const status = statusOf(service);
            const KindIcon = KIND_ICON[service.providerKind];
            const [daily, monthly] = snapshots(service.id, state);
            const isOpen = expanded === service.id;

            return (
              <div
                key={service.id}
                className="rounded-2xl border border-border/70 bg-card/40 p-3 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="hud-title flex items-center gap-2 text-sm font-semibold">
                      <KindIcon className="h-3.5 w-3.5 text-primary" />
                      {service.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {service.description[language]}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="hud-text rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
                        {service.category.toUpperCase()}
                      </span>
                      <span className="hud-text rounded-full border border-border px-2 py-0.5 text-[9px] text-muted-foreground">
                        {t(
                          language,
                          service.providerKind === "local"
                            ? "kindLocal"
                            : service.providerKind === "browser"
                              ? "kindBrowser"
                              : service.providerKind === "online"
                                ? "kindOnline"
                                : "kindUnknown",
                        )}
                      </span>
                      <span
                        className={
                          "hud-text rounded-full px-2 py-0.5 text-[9px] " +
                          (status.tone === "ok"
                            ? "border border-primary/40 bg-primary/10 text-primary"
                            : status.tone === "danger"
                              ? "border border-destructive/40 bg-destructive/10 text-destructive"
                              : "border border-border text-muted-foreground")
                        }
                      >
                        {t(language, status.key)}
                      </span>
                    </div>
                  </div>

                  {service.toggleable ? (
                    <Switch
                      checked={entry.enabled}
                      onCheckedChange={(checked) => setEnabled(service.id, checked)}
                      aria-label={service.name}
                    />
                  ) : null}
                </div>

                {/* KULLANIM */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[daily, monthly].map((snapshot) =>
                    snapshot ? (
                      <div
                        key={snapshot.period}
                        className="rounded-xl border border-border/50 bg-secondary/15 p-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="hud-text text-[10px] text-muted-foreground">
                            {t(language, snapshot.period === "daily" ? "periodDaily" : "periodMonthly")}
                          </span>
                          <span className="hud-text text-[10px] text-primary">
                            {snapshot.used} {unitLabel(language, snapshot.unit)}
                          </span>
                        </div>
                        {snapshot.limit ? (
                          <>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(100, (snapshot.used / snapshot.limit) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="hud-text mt-1 text-[9px] text-muted-foreground">
                              {t(language, "remaining")}: {snapshot.remaining} / {snapshot.limit} ·{" "}
                              {t(
                                language,
                                snapshot.source === "official"
                                  ? "sourceOfficial"
                                  : snapshot.source === "manual"
                                    ? "sourceManual"
                                    : "sourceLocal",
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="hud-text mt-1 text-[9px] text-muted-foreground opacity-80">
                            {t(language, "noQuotaData")}
                          </p>
                        )}
                        <p className="hud-text mt-1 text-[9px] text-muted-foreground opacity-70">
                          {t(language, "resetsAt")}: {formatTime(language, snapshot.periodEnd)}
                        </p>
                      </div>
                    ) : null,
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="hud-text text-[9px] text-muted-foreground opacity-70">
                    {t(language, "lastUpdated")}: {formatTime(language, entry.lastUpdated)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hud-text h-7 rounded-full px-2 text-[10px]"
                    onClick={() => setExpanded(isOpen ? null : service.id)}
                  >
                    <Info className="mr-1 h-3 w-3" />
                    {t(language, "details")}
                    <ChevronDown
                      className={"ml-1 h-3 w-3 transition-transform " + (isOpen ? "rotate-180" : "")}
                    />
                  </Button>
                </div>

                {isOpen ? (
                  <div className="mt-2 space-y-3 rounded-xl border border-border/50 bg-secondary/10 p-3">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {service.details[language]}
                    </p>
                    <dl className="grid gap-1.5 text-[10px] sm:grid-cols-2">
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "quotaUnit")}</dt>
                        <dd>{unitLabel(language, service.quotaUnit)}</dd>
                      </div>
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "limitPeriod")}</dt>
                        <dd>
                          {service.limitPeriod === "none"
                            ? t(language, "periodNone")
                            : service.limitPeriod === "unknown"
                              ? t(language, "periodUnknown")
                              : service.limitPeriod}
                        </dd>
                      </div>
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "officialQuota")}</dt>
                        <dd>{service.officialLimit ?? t(language, "quotaUnavailable")}</dd>
                      </div>
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "dataPath")}</dt>
                        <dd>
                          {t(
                            language,
                            service.dataLeavesDevice === "no"
                              ? "dataLocal"
                              : service.dataLeavesDevice === "possible"
                                ? "dataMaybe"
                                : "dataOnline",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "fallback")}</dt>
                        <dd>{service.fallbackProviderId ?? t(language, "noFallback")}</dd>
                      </div>
                      <div>
                        <dt className="hud-text text-muted-foreground">{t(language, "trackingMode")}</dt>
                        <dd>{t(language, "sourceLocal")}</dd>
                      </div>
                    </dl>

                    <div className="space-y-2 border-t border-border/50 pt-2">
                      <p className="hud-text text-[10px] text-muted-foreground">
                        {t(language, "manualLimitNote")}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="h-8 w-32 text-xs"
                          inputMode="numeric"
                          placeholder={t(language, "dailyLimit")}
                          value={entry.manualDailyLimit ?? ""}
                          onChange={(event) => setLimit(service.id, "daily", event.target.value)}
                        />
                        <Input
                          className="h-8 w-32 text-xs"
                          inputMode="numeric"
                          placeholder={t(language, "monthlyLimit")}
                          value={entry.manualMonthlyLimit ?? ""}
                          onChange={(event) => setLimit(service.id, "monthly", event.target.value)}
                        />
                        <label className="hud-text flex items-center gap-2 text-[10px]">
                          <Switch
                            checked={entry.enforce}
                            onCheckedChange={(checked) => setEnforce(service.id, checked)}
                          />
                          {t(language, "enforceLimit")}
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hud-text h-8 rounded-full text-[10px]"
                          onClick={() => resetUsage(service.id)}
                        >
                          {t(language, "resetCounters")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
