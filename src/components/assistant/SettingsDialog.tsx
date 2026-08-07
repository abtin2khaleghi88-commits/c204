import { Languages } from "lucide-react";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
};

export function SettingsDialog({ open, onOpenChange, settings, onChange }: Props) {
  const language = settings.language;

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
            <Label htmlFor="auto-speak">{t(language, "autoSpeak")}</Label>
            <Switch
              id="auto-speak"
              checked={settings.autoSpeak}
              onCheckedChange={(checked) => onChange({ ...settings, autoSpeak: checked })}
            />
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
