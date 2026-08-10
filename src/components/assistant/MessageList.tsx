import { FileText, Volume2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AssistantOrb, PulseRing, VoiceWave } from "@/components/assistant/VoiceWave";
import type { Language, UiMessage } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = {
  language: Language;
  messages: UiMessage[];
  thinking: boolean;
  memoryScanning: boolean;
  speakingId: string | null;
  levels: number[];
  onSpeak: (message: UiMessage) => void;
  onStop: () => void;
};

export function MessageList({
  language,
  messages,
  thinking,
  memoryScanning,
  speakingId,
  levels,
  onSpeak,
  onStop,
}: Props) {
  if (messages.length === 0 && !thinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <PulseRing active={false} size={240} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {t(language, "emptyTitle")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t(language, "emptySubtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="animate-rise-in flex justify-end">
              <div className="max-w-[80%] space-y-2">
                <div className="rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {message.content}
                </div>
                {message.attachments?.length ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {message.attachments.map((file) => (
                      <span
                        key={file.name}
                        className="hud-text flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] text-secondary-foreground"
                      >
                        <FileText className="h-3 w-3" />
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div key={message.id} className="animate-rise-in flex gap-3">
              <AssistantOrb
                speaking={speakingId === message.id}
                level={speakingId === message.id ? Math.max(...levels, 0) : 0}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {message.content}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {speakingId === message.id ? (
                    <>
                      <VoiceWave active levels={levels} label={t(language, "speaking")} />
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={onStop}>
                        <Square className="h-3.5 w-3.5" />
                        {t(language, "stop")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => onSpeak(message)}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {t(language, "play")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {/* Hafiza taramasi gostergesi - %50 opaklik, dikkat cekmeyen */}
        {memoryScanning && (
          <p className="hud-text text-[10px] opacity-50">{t(language, "scanning")}</p>
        )}

        {thinking && (
          <div className="flex gap-3">
            <AssistantOrb speaking />
            <p className="text-shimmer hud-text text-xs font-medium">{t(language, "thinking")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
