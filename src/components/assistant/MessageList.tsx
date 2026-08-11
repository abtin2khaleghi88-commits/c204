import { Check, Copy, FileText, Pencil, RefreshCw, Square, Volume2 } from "lucide-react";
import { useState } from "react";

import { Markdown } from "@/components/assistant/Markdown";
import { MemoryHits } from "@/components/assistant/MemoryHits";
import { AssistantOrb, PulseRing, VoiceWave } from "@/components/assistant/VoiceWave";
import { Button } from "@/components/ui/button";
import type { Language, UiMessage } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = {
  language: Language;
  messages: UiMessage[];
  thinking: boolean;
  streamingId: string | null;
  memoryScanning: boolean;
  speakingId: string | null;
  levels: number[];
  onSpeak: (message: UiMessage) => void;
  onStop: () => void;
  onRegenerate: (message: UiMessage) => void;
  onEditUser: (message: UiMessage) => void;
};

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary/70 hover:text-primary"
    >
      {children}
    </button>
  );
}

function CopyAction({ language, text }: { language: Language; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      label={copied ? t(language, "copied") : t(language, "copy")}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </ActionButton>
  );
}

function Attachments({ files }: { files: NonNullable<UiMessage["attachments"]> }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {files.map((file) =>
        file.preview ? (
          <img
            key={file.name}
            src={file.preview}
            alt={file.name}
            loading="lazy"
            className="h-16 w-16 rounded-lg border border-border object-cover"
          />
        ) : (
          <span
            key={file.name}
            className="hud-text flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] text-secondary-foreground"
          >
            <FileText className="h-3 w-3" />
            {file.name}
          </span>
        ),
      )}
    </div>
  );
}

export function MessageList({
  language,
  messages,
  thinking,
  streamingId,
  memoryScanning,
  speakingId,
  levels,
  onSpeak,
  onStop,
  onRegenerate,
  onEditUser,
}: Props) {
  if (messages.length === 0 && !thinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <PulseRing active={false} size={200} />
        <h1 className="hud-title mt-6 text-xl font-semibold tracking-tight sm:text-2xl">
          {t(language, "emptyTitle")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t(language, "emptySubtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6 sm:px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="group animate-rise-in flex justify-end">
              <div className="max-w-[85%] space-y-2 sm:max-w-[80%]">
                <div className="rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {message.content}
                </div>
                {message.attachments?.length ? (
                  <Attachments files={message.attachments} />
                ) : null}
                <div className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <CopyAction language={language} text={message.content} />
                  <ActionButton
                    label={t(language, "editMessage")}
                    onClick={() => onEditUser(message)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : (
            <div key={message.id} className="group animate-rise-in flex gap-3">
              <AssistantOrb
                speaking={speakingId === message.id || streamingId === message.id}
                level={speakingId === message.id ? Math.max(...levels, 0) : 0}
              />
              <div className="min-w-0 flex-1">
                {message.memoryHits?.length ? (
                  <MemoryHits
                    language={language}
                    hits={message.memoryHits}
                    scanned={message.memoryScanned}
                    tookMs={message.memoryTookMs}
                  />
                ) : null}

                <Markdown content={message.content} />
                {streamingId === message.id && (
                  <span className="caret-blink ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 bg-primary" />
                )}

                <div className="mt-2 flex items-center gap-2">
                  {speakingId === message.id ? (
                    <>
                      <VoiceWave active levels={levels} label={t(language, "speaking")} />
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={onStop}>
                        <Square className="h-3.5 w-3.5" />
                        {t(language, "stop")}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100 focus-within:opacity-100">
                      <ActionButton
                        label={t(language, "play")}
                        onClick={() => onSpeak(message)}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </ActionButton>
                      <CopyAction language={language} text={message.content} />
                      <ActionButton
                        label={t(language, "regenerate")}
                        onClick={() => onRegenerate(message)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </ActionButton>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {/* Hafiza taramasi gostergesi - %50 opaklik, dikkat cekmeyen */}
        {memoryScanning && (
          <p className="hud-text flex items-center gap-2 text-[10px] opacity-50">
            <span className="scan-dot" />
            {t(language, "scanning")}
          </p>
        )}

        {thinking && !streamingId && (
          <div className="flex gap-3">
            <AssistantOrb speaking />
            <p className="text-shimmer hud-text text-xs font-medium">{t(language, "thinking")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
