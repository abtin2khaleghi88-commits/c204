import { Paperclip, SendHorizonal, X, Brain } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Language } from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

export type PendingFile = { name: string; size: number; excerpt: string };

type Props = {
  language: Language;
  disabled: boolean;
  useShortTerm: boolean;
  onToggleShortTerm: () => void;
  onSend: (text: string, files: PendingFile[]) => void;
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

export function Composer({
  language,
  disabled,
  useShortTerm,
  onToggleShortTerm,
  onSend,
}: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const parsed = await Promise.all(
      [...list].map(async (file) => ({
        name: file.name,
        size: file.size,
        excerpt: await readExcerpt(file),
      })),
    );
    setFiles((prev) => [...prev, ...parsed]);
  };

  const submit = () => {
    if (disabled || (!text.trim() && files.length === 0)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
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
            <span
              key={`${file.name}-${index}`}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              {file.name}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t(language, "delete")}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
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
            {t(language, "attach")}
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
            {t(language, "shortTerm")}
          </Button>
        </div>

        <Button type="button" size="icon" onClick={submit} disabled={disabled}>
          <SendHorizonal className="h-4 w-4" />
          <span className="sr-only">{t(language, "send")}</span>
        </Button>
      </div>
    </div>
  );
}
