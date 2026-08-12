import { Brain, Paperclip, SendHorizonal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Language } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

export type PendingFile = {
  name: string;
  size: number;
  excerpt: string;
  type?: string;
  /** Resim dosyalari icin kucuk onizleme (data URL) */
  preview?: string;
};

export type DraftPatch = { text: string; id: number };

type Props = {
  language: Language;
  disabled: boolean;
  useShortTerm: boolean;
  draft?: DraftPatch;
  /** Push-to-talk durumu */
  recording?: boolean;
  transcribing?: boolean;
  levels?: number[];
  pushToTalkKey?: string;
  onToggleShortTerm: () => void;
  onSend: (text: string, files: PendingFile[]) => void;
  onMicDown?: () => void;
  onMicUp?: () => void;
};

async function readExcerpt(file: File): Promise<string> {
  const textLike =
    file.type.startsWith("text/") ||
    /\.(txt|md|json|csv|ts|tsx|js|py|yml|yaml|log|html|css)$/i.test(file.name);
  if (!textLike) return `[binary file, ${file.size} bytes]`;
  try {
    return (await file.text()).slice(0, 4000);
  } catch {
    return `[unreadable file]`;
  }
}

async function readPreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/") || file.size > 4_000_000) return undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } catch {
    return undefined;
  }
}

export function Composer({
  language,
  disabled,
  useShortTerm,
  draft,
  recording = false,
  transcribing = false,
  levels = [],
  pushToTalkKey,
  onToggleShortTerm,
  onSend,
  onMicDown,
  onMicUp,
}: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Odak: ilk render, gonderim sonrasi ve duzenleme talebinde
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (draft === undefined) return;
    setText(draft.text);
    textareaRef.current?.focus();
  }, [draft]);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const parsed = await Promise.all(
      [...list].map(async (file) => {
        const preview = await readPreview(file);
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          excerpt: await readExcerpt(file),
          ...(preview ? { preview } : {}),
        } satisfies PendingFile;
      }),
    );
    setFiles((prev) => [...prev, ...parsed]);
  };

  const submit = () => {
    if (disabled || (!text.trim() && files.length === 0)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
    textareaRef.current?.focus();
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
      className={
        "surface-card relative rounded-3xl p-3 transition " + (dragging ? "glow-ring" : "")
      }
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-primary/10 text-sm font-medium text-primary">
          {t(language, "dropHere")}
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="group relative flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-1.5 pr-2"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-9 w-9 rounded-lg object-cover"
                />
              ) : (
                <span className="hud-text flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-[9px] text-primary">
                  {(file.name.split(".").pop() ?? "?").slice(0, 4).toUpperCase()}
                </span>
              )}
              <span className="max-w-[140px] truncate text-xs text-secondary-foreground">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t(language, "delete")}
                className="text-muted-foreground transition hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          const isSendCombo =
            event.key === "Enter" && (event.ctrlKey || event.metaKey || !event.shiftKey);
          if (isSendCombo) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={t(language, "placeholder")}
        rows={2}
        className="resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
      />

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void addFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, "attach")}</span>
          </Button>
          <Button
            type="button"
            variant={useShortTerm ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={onToggleShortTerm}
            title={t(language, "useShortTerm")}
          >
            <Brain className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{t(language, "shortTerm")}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hud-text hidden text-[10px] text-muted-foreground sm:inline">
            {t(language, "sendHint")}
          </span>
          <Button type="button" size="icon" onClick={submit} disabled={disabled}>
            <SendHorizonal className="h-4 w-4" />
            <span className="sr-only">{t(language, "send")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
