import { Activity, MessageSquare, Plus, Brain, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/assistant-client";
import type { Conversation } from "@/lib/chat-storage";
import { t } from "@/lib/i18n";

type Props = {
  language: Language;
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenUsage: () => void;
};

export function ConversationSidebar({
  language,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenMemory,
  onOpenSettings,
}: Props) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="glow-ring flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 font-mono text-[10px] font-bold tracking-widest text-primary">
          C2
        </span>
        <div className="leading-tight">
          <p className="hud-title text-sm font-semibold text-sidebar-foreground">{t(language, "appName")}</p>
          <p className="hud-text text-[10px] text-primary/70">offline · local</p>
        </div>
      </div>

      <div className="px-3">
        <Button onClick={onNew} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          {t(language, "newChat")}
        </Button>
      </div>

      <p className="hud-text px-4 pt-5 pb-2 text-[10px] font-semibold text-muted-foreground">
        {t(language, "conversations")}
      </p>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;
          return (
            <div
              key={conversation.id}
              className={
                "group flex items-start gap-2 rounded-lg border px-3 py-2.5 backdrop-blur-sm transition-colors " +
                (isActive
                  ? "border-primary/50 bg-sidebar-accent glow-ring"
                  : "border-transparent hover:bg-sidebar-accent/60")
              }
            >
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-sidebar-foreground">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{conversation.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {conversation.messages.at(-1)?.content ?? "—"}
                </span>
              </button>
              <button
                type="button"
                aria-label={t(language, "delete")}
                onClick={() => onDelete(conversation.id)}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onOpenMemory}>
          <Brain className="h-4 w-4 text-primary" />
          {t(language, "memoryPanel")}
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onOpenSettings}>
          <Settings2 className="h-4 w-4 text-primary" />
          {t(language, "settings")}
        </Button>
      </div>
    </aside>
  );
}
