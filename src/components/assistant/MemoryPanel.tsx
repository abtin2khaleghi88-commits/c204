import { Brain, Network, Plus, Save, Search, Trash2, Pencil, List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MemoryGraph } from "@/components/assistant/MemoryGraph";
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
  deleteMemories,
  listMemories,
  upsertMemory,
  type Language,
  type MemoryLink,
  type MemoryRecord,
} from "@/lib/assistant-client";
import { t } from "@/lib/i18n";

type Props = { language: Language; open: boolean; onOpenChange: (open: boolean) => void };

export function MemoryPanel({ language, open, onOpenChange }: Props) {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [links, setLinks] = useState<MemoryLink[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"list" | "graph">("list");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "", category: "" });
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await listMemories();
      setRecords(next.records);
      setLinks(next.links);
      setCategories(next.categories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesCategory = category === "all" || record.category === category;
      const matchesQuery =
        needle.length === 0 ||
        `${record.title} ${record.content} ${record.tags.join(" ")}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [records, query, category]);

  const startEdit = (record: MemoryRecord) => {
    setEditingId(record.id);
    setDraft({ title: record.title, content: record.content, category: record.category });
  };

  const save = async (record: MemoryRecord) => {
    await upsertMemory({ ...record, ...draft });
    setEditingId(null);
    await refresh();
  };

  const removeMany = async (ids: string[]) => {
    if (ids.length === 0) return;
    await deleteMemories(ids);
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    await refresh();
  };

  const addNew = async () => {
    await upsertMemory({
      scope: "long",
      title: language === "tr" ? "Yeni kayit" : "New record",
      content: "",
      category: "general",
      approved: true,
    });
    await refresh();
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const groups: { scope: "short" | "long"; label: string }[] = [
    { scope: "short", label: t(language, "shortTerm") },
    { scope: "long", label: t(language, "longTerm") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="hud-title flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t(language, "memoryPanel")}
          </DialogTitle>
          <DialogDescription>
            {language === "tr"
              ? "Kisa sureli hafiza son 2 konusma ozetidir. Uzun sureli hafiza vektor aramasi ile sadece en alakali kayitlari getirir."
              : "Short-term memory holds the last 2 conversation summaries. Long-term memory retrieves only the most relevant records via vector search."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(language, "search")}
              className="pl-9"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="hud-text h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="all">{t(language, "allCategories")}</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setView(view === "list" ? "graph" : "list")}
          >
            {view === "list" ? (
              <>
                <Network className="h-4 w-4 text-primary" />
                {t(language, "graphView")}
              </>
            ) : (
              <>
                <List className="h-4 w-4 text-primary" />
                {t(language, "listView")}
              </>
            )}
          </Button>
        </div>

        {selected.length > 0 && (
          <div className="animate-rise-in flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="hud-text text-[11px] text-primary">
              {selected.length} {t(language, "selected")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={() => void removeMany(selected)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t(language, "deleteSelected")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              {t(language, "clearSelection")}
            </Button>
          </div>
        )}

        {view === "graph" ? (
          <MemoryGraph
            language={language}
            records={filtered}
            links={links}
            selectedId={focusId}
            onSelect={setFocusId}
          />
        ) : (
          <div className="space-y-6">
            {loading && records.length === 0 && (
              <div className="space-y-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="shimmer-block h-16 rounded-2xl" />
                ))}
              </div>
            )}

            {groups.map((group) => {
              const items = filtered.filter((record) => record.scope === group.scope);
              return (
                <section key={group.scope} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="hud-text text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label} · {items.length}
                    </h3>
                    {items.length > 0 && (
                      <button
                        type="button"
                        className="hud-text text-[10px] text-primary/80 hover:text-primary"
                        onClick={() =>
                          setSelected((prev) => [
                            ...new Set([...prev, ...items.map((item) => item.id)]),
                          ])
                        }
                      >
                        {t(language, "selectAll")}
                      </button>
                    )}
                  </div>

                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {query ? t(language, "noResults") : t(language, "noMemories")}
                    </p>
                  )}

                  {items.map((record) => (
                    <div
                      key={record.id}
                      className={
                        "surface-card rounded-2xl p-3 transition " +
                        (selected.includes(record.id) ? "glow-ring border-primary/50" : "")
                      }
                    >
                      {editingId === record.id ? (
                        <div className="space-y-2">
                          <Input
                            value={draft.title}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, title: event.target.value }))
                            }
                            placeholder={t(language, "title")}
                          />
                          <Input
                            value={draft.category}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, category: event.target.value }))
                            }
                            placeholder={t(language, "category")}
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
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(record.id)}
                            onChange={() => toggle(record.id)}
                            className="mt-1 h-3.5 w-3.5 accent-[var(--primary)]"
                            aria-label={record.title}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {record.title}
                              <span className="hud-text rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[9px] text-primary">
                                {record.category}
                              </span>
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {record.content || "—"}
                            </p>
                            {record.tags.length > 0 && (
                              <p className="hud-text mt-1 text-[10px] text-muted-foreground opacity-70">
                                #{record.tags.join(" #")}
                              </p>
                            )}
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
                              onClick={() => void removeMany([record.id])}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
