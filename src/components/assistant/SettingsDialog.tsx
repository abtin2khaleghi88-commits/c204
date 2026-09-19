import { Languages, Mic, Palette } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/chat-storage";
import { t } from "@/lib/i18n";
import type { ThemeMode } from "@/lib/theme";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
};

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  theme,
  onThemeChange,
}: Props) {
  const language = settings.language;
  const [capturing, setCapturing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(language, "settings")}</DialogTitle>
          <DialogDescription>
            {language === "tr"
              ? "Dil, sesli yanit ve hafiza tercihleri."
              : "Language, spoken replies and memory preferences."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              {t(language, "language")}
            </Label>
            <div className="flex rounded-full bg-secondary p-1">
              {(["tr", "en"] as const).map((code) => (
                <Button
                  key={code}
                  size="sm"
                  variant={language === code ? "default" : "ghost"}
                  className="rounded-full px-4"
                  onClick={() => onChange({ ...settings, language: code })}
                >
                  {code === "tr" ? "Türkçe" : "English"}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              {t(language, "theme")}
            </Label>
            <div className="flex rounded-full bg-secondary p-1">
              {(["light", "dark", "system"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={theme === mode ? "default" : "ghost"}
                  className="rounded-full px-3"
                  onClick={() => onThemeChange(mode)}
                >
                  {t(
                    language,
                    mode === "light" ? "themeLight" : mode === "dark" ? "themeDark" : "themeSystem",
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto-speak">{t(language, "autoSpeak")}</Label>
            <Switch
              id="auto-speak"
              checked={settings.autoSpeak}
              onCheckedChange={(checked) => onChange({ ...settings, autoSpeak: checked })}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/20 p-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="stt-enabled" className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                {t(language, "pushToTalk")}
              </Label>
              <Switch
                id="stt-enabled"
                checked={settings.sttEnabled}
                onCheckedChange={(checked) => onChange({ ...settings, sttEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label className="text-muted-foreground">{t(language, "pushToTalkKey")}</Label>
              <Button
                size="sm"
                variant={capturing ? "default" : "secondary"}
                className="hud-text min-w-[140px] rounded-full text-[11px]"
                onClick={() => setCapturing(true)}
                onKeyDown={(event) => {
                  if (!capturing) return;
                  event.preventDefault();
                  if (event.code === "Escape") {
                    setCapturing(false);
                    return;
                  }
                  onChange({ ...settings, pushToTalkKey: event.code });
                  setCapturing(false);
                }}
              >
                {capturing ? t(language, "pressAnyKey") : settings.pushToTalkKey}
              </Button>
            </div>
            <p className="hud-text text-[10px] text-muted-foreground opacity-70">
              {settings.pushToTalkKey} — {t(language, "sttHint")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="short-term">{t(language, "useShortTerm")}</Label>
            <Switch
              id="short-term"
              checked={settings.useShortTerm}
              onCheckedChange={(checked) => onChange({ ...settings, useShortTerm: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="long-term">{t(language, "useLongTerm")}</Label>
            <Switch
              id="long-term"
              checked={settings.useLongTerm}
              onCheckedChange={(checked) => onChange({ ...settings, useLongTerm: checked })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
