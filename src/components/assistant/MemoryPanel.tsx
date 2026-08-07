import { Brain, Plus, Save, Trash2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMemory,
  listMemories,
  upsertMemory,
  type Language,
  type MemoryRecord,
} from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = { language: Language; open: boolean; onOpenChange: (open: boolean) => void };

export function MemoryPanel({ language, open, onOpenChange }: Props) {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const refresh = async () => {
    const { records: next } = await listMemories();
    setRecords(next);
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const startEdit = (record: MemoryRecord) => {
    setEditingId(record.id);
    setDraft({ title: record.title, content: record.content });
  };

  const save = async (record: MemoryRecord) => {
    await upsertMemory({ ...record, ...draft });
    setEditingId(null);
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteMemory(id);
    await refresh();
  };

  const addNew = async () => {
    await upsertMemory({
      scope: "long",
      title: language === "tr" ? "Yeni kayit" : "New record",
      content: "",
      approved: true,
    });
    await refresh();
  };

  const groups: { scope: "short" | "long"; label: string }[] = [
    { scope: "short", label: t(language, "shortTerm") },
    { scope: "long", label: t(language, "longTerm") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t(language, "memoryPanel")}
          </DialogTitle>
          <DialogDescription>
            {language === "tr"
              ? "Hangi bilgilerin saklanacagina siz karar verin. Kayitlar yerel hafiza katmaninda tutulur."
              : "You decide what gets stored. Records live in the local memory layer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {groups.map((group) => {
            const items = records.filter((record) => record.scope === group.scope);
            return (
              <section key={group.scope} className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h3>
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t(language, "noMemories")}</p>
                )}
                {items.map((record) => (
                  <div key={record.id} className="surface-card rounded-2xl p-3">
                    {editingId === record.id ? (
                      <div className="space-y-2">
                        <Input
                          value={draft.title}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, title: event.target.value }))
                          }
                          placeholder={t(language, "title")}
                        />
                        <Textarea
                          value={draft.content}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, content: event.target.value }))
                          }
                          placeholder={t(language, "content")}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1.5" onClick={() => void save(record)}>
                            <Save className="h-3.5 w-3.5" />
                            {t(language, "save")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            {t(language, "cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{record.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {record.content || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t(language, "edit")}
                            onClick={() => startEdit(record)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t(language, "delete")}
                            onClick={() => void remove(record.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}

          <Button variant="secondary" className="gap-1.5" onClick={() => void addNew()}>
            <Plus className="h-4 w-4" />
            {t(language, "add")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
