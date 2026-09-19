import { createFileRoute } from "@tanstack/react-router";
import { Activity, Menu, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Composer, type DraftPatch, type PendingFile } from "@/components/assistant/Composer";
import { ConversationSidebar } from "@/components/assistant/ConversationSidebar";
import { MemoryPanel } from "@/components/assistant/MemoryPanel";
import { MessageList } from "@/components/assistant/MessageList";
import { SettingsDialog } from "@/components/assistant/SettingsDialog";
import { UsagePanel } from "@/components/assistant/UsagePanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { streamChat, type MemoryHit, type UiMessage } from "@/lib/assistant-client";
import type { PlaybackHandle } from "@/lib/audio-player";
import {
  loadConversations,
  loadSettings,
  newConversation,
  saveConversations,
  saveSettings,
  type Conversation,
  type Settings,
} from "@/lib/chat-storage";
import { defaultSettings } from "@/lib/chat-storage";
import { t } from "@/lib/i18n";
import type { AvailabilityMap } from "@/lib/services/provider-manager";
import { loadUsageState, subscribeUsage } from "@/lib/services/usage-store";
import {
  loadAvailability,
  planStt,
  recordAiUsage,
  recordMemoryUsage,
  recordSttUsage,
  speakViaProviders,
} from "@/lib/services/voice";
import {
  applyTheme,
  loadTheme,
  prefersDark,
  saveTheme,
  watchSystemTheme,
  type ThemeMode,
} from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "C204 · Yerel AI Asistan Arayüzü" },
      {
        name: "description",
        content:
          "C204: tamamen yerel çalışan AI + TTS sohbet arayüzü: vektör tabanlı hafıza, dosya paylaşımı ve Türkçe/İngilizce dil desteği.",
      },
      { property: "og:title", content: "C204 · Yerel AI Asistan Arayüzü" },
      {
        property: "og:description",
        content:
          "C204, yerel AI sunucunuza bağlanan, sesli yanıt veren ve vektör tabanlı hafıza yönetimi sunan sohbet arayüzü.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [thinking, setThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [memoryScanning, setMemoryScanning] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isDark, setIsDark] = useState(false);
  const [draft, setDraft] = useState<DraftPatch | undefined>(undefined);
  /** Saglayici erisilebilirligi (yerel uclar + tarayici yetenekleri). */
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  /** Kullanim/kontrol durumu — kapali saglayici cagrilmasin diye izlenir. */
  const [usageState, setUsageState] = useState(() => loadUsageState());
  const [notice, setNotice] = useState<string | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedSettings = loadSettings();
    const stored = loadConversations();
    const list = stored.length > 0 ? stored : [newConversation(storedSettings.language)];
    setSettings(storedSettings);
    setConversations(list);
    setActiveId(list[0]!.id);

    const storedTheme = loadTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
    setIsDark(storedTheme === "dark" || (storedTheme === "system" && prefersDark()));
  }, []);

  // Saglayici durumu: ilk yuklemede bir kez (gereksiz polling yok).
  useEffect(() => {
    void loadAvailability(true).then(setAvailability);
    return subscribeUsage(() => setUsageState(loadUsageState()));
  }, []);

  const sttPlan = useMemo(
    () => planStt(availability),
    // usageState degistiginde plan yeniden hesaplanir (toggle'lar gercekten etki eder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availability, usageState],
  );

  useEffect(() => {
    if (theme !== "system") return;
    return watchSystemTheme(() => {
      applyTheme("system");
      setIsDark(prefersDark());
    });
  }, [theme]);

  const updateTheme = (next: ThemeMode) => {
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
    setIsDark(next === "dark" || (next === "system" && prefersDark()));
  };

  const language = settings.language;
  const active = conversations.find((conversation) => conversation.id === activeId);

  const persist = (next: Conversation[]) => {
    setConversations(next);
    saveConversations(next);
  };

  /** Aktif sohbeti guvenli sekilde guncelle (streaming icin fonksiyonel setState). */
  const mutateActive = useCallback(
    (id: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((prev) => {
        const next = prev.map((conversation) =>
          conversation.id === id ? updater(conversation) : conversation,
        );
        saveConversations(next);
        return next;
      });
    },
    [],
  );

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  /** Push-to-talk (basili tutarak konusma): metin otomatik gonderilmez. */
  const pushToTalk = usePushToTalk({
    keyCode: settings.pushToTalkKey,
    language,
    enabled: settings.sttEnabled && !settingsOpen && !usageOpen,
    allowLocal: sttPlan.allowLocal,
    allowBrowser: sttPlan.allowBrowser,
    onUsage: recordSttUsage,
    onTranscript: useCallback((text: string) => setDraft({ text, id: Date.now() }), []),
  });

  // Yeni mesajlarda otomatik kaydirma
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversations, thinking]);

  /** TTS: saglayici yoneticisi secer, kapali saglayici cagrilmaz. */
  const playAudio = async (message: UiMessage) => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setSpeakingId(message.id);
    const outcome = await speakViaProviders(message.content, language, availability, {
      onLevels: setLevels,
      onEnded: () => {
        playbackRef.current = null;
        setLevels([]);
        setSpeakingId(null);
      },
    });
    if (!outcome.ok) {
      setLevels([]);
      setSpeakingId(null);
      setNotice(t(language, "voiceOff"));
      return;
    }
    playbackRef.current = outcome.handle;
    if (outcome.fellBack) setNotice(t(language, "usedFallback"));
  };

  const stopAudio = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setLevels([]);
    setSpeakingId(null);
  };

  /** Akan yaniti uretir; gecmisi hazir alir (yeniden olusturma da bunu kullanir). */
  const runAssistant = async (
    conversationId: string,
    history: { role: "user" | "assistant"; content: string }[],
    attachments: { name: string; excerpt: string }[],
  ) => {
    // AI yetenegi kapaliysa istek HIC gonderilmez.
    if (!usageState.features.ai) {
      setNotice(t(language, "aiOff"));
      return;
    }
    const assistantId = `m-${Date.now()}-a`;
    const useMemory = settings.useShortTerm || settings.useLongTerm;
    setThinking(true);
    setMemoryScanning(useMemory);

    const placeholder: UiMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    mutateActive(conversationId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, placeholder],
    }));

    const patch = (fields: Partial<UiMessage>, append?: string) =>
      mutateActive(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                ...fields,
                ...(append ? { content: message.content + append } : {}),
              }
            : message,
        ),
      }));

    let text = "";
    try {
      await streamChat(
        {
          messages: history,
          language,
          useShortTerm: settings.useShortTerm,
          useLongTerm: settings.useLongTerm,
          attachments,
        },
        {
          onMemory: (payload: { hits: MemoryHit[]; scanned: number; tookMs: number }) => {
            setMemoryScanning(false);
            if (useMemory) recordMemoryUsage();
            patch({
              memoryHits: payload.hits,
              memoryScanned: payload.scanned,
              memoryTookMs: payload.tookMs,
            });
          },
          onDelta: (delta) => {
            if (!text) setStreamingId(assistantId);
            text += delta;
            patch({}, delta);
          },
          onDone: (payload) => {
            recordAiUsage(payload.source);
            patch({ source: payload.source });
          },
        },
      );

      if (settings.autoSpeak && text.trim()) {
        void playAudio({ ...placeholder, content: text });
      }
    } catch (error) {
      patch({
        content:
          language === "tr"
            ? `Yanit alinamadi: ${String(error)}`
            : `Could not get a reply: ${String(error)}`,
      });
    } finally {
      setThinking(false);
      setStreamingId(null);
      setMemoryScanning(false);
    }
  };

  const handleSend = async (text: string, files: PendingFile[]) => {
    if (!active) return;
    setDraft(undefined);

    const userMessage: UiMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      content: text || (language === "tr" ? "(dosya eklendi)" : "(file attached)"),
      createdAt: new Date().toISOString(),
      attachments: files.map((file) => ({
        name: file.name,
        size: file.size,
        ...(file.type ? { type: file.type } : {}),
        ...(file.preview ? { preview: file.preview } : {}),
      })),
    };

    mutateActive(active.id, (conversation) => ({
      ...conversation,
      title:
        conversation.messages.length === 0 ? userMessage.content.slice(0, 40) : conversation.title,
      messages: [...conversation.messages, userMessage],
    }));

    const history = [...active.messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    await runAssistant(
      active.id,
      history,
      files.map((file) => ({ name: file.name, excerpt: file.excerpt })),
    );
  };

  /** Bir asistan yanitini sil ve o ana kadarki gecmisle yeniden uret. */
  const handleRegenerate = async (message: UiMessage) => {
    if (!active) return;
    const index = active.messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const history = active.messages.slice(0, index).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    mutateActive(active.id, (conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(0, index),
    }));
    await runAssistant(active.id, history, []);
  };

  /** Kullanici mesajini composer'a geri yukler (duzenle). */
  const handleEditUser = (message: UiMessage) => {
    if (!active) return;
    const index = active.messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    mutateActive(active.id, (conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(0, index),
    }));
    setDraft({ text: message.content, id: Date.now() });
  };

  const handleNew = () => {
    const conversation = newConversation(language);
    persist([conversation, ...conversations]);
    setActiveId(conversation.id);
    setMobileNavOpen(false);
  };

  const handleDelete = (id: string) => {
    const next = conversations.filter((conversation) => conversation.id !== id);
    const list = next.length > 0 ? next : [newConversation(language)];
    persist(list);
    if (id === activeId) setActiveId(list[0]!.id);
  };

  // Klavye kisayollari: Ctrl+K yeni sohbet, Ctrl+M hafiza, Ctrl+, ayarlar
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleNew();
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMemoryOpen((open) => !open);
      } else if (event.key === ",") {
        event.preventDefault();
        setSettingsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sidebar = (
    <ConversationSidebar
      language={language}
      conversations={conversations}
      activeId={activeId}
      onSelect={(id) => {
        setActiveId(id);
        setMobileNavOpen(false);
      }}
      onNew={handleNew}
      onDelete={handleDelete}
      onOpenMemory={() => {
        setMemoryOpen(true);
        setMobileNavOpen(false);
      }}
      onOpenSettings={() => {
        setSettingsOpen(true);
        setMobileNavOpen(false);
      }}
      onOpenUsage={() => {
        setUsageOpen(true);
        setMobileNavOpen(false);
      }}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">{sidebar}</div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" aria-label="menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">{t(language, "conversations")}</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
            <h2 className="hud-title truncate text-xs font-medium">
              {active?.title ?? t(language, "newChat")}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hud-text hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary sm:inline">
              {language === "tr" ? "Türkçe" : "English"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={t(language, "usagePanel")}
              title={t(language, "usagePanel")}
              onClick={() => setUsageOpen(true)}
            >
              <Activity className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={t(language, "theme")}
              title={t(language, "theme")}
              onClick={() => updateTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <MessageList
            language={language}
            messages={active?.messages ?? []}
            thinking={thinking}
            streamingId={streamingId}
            memoryScanning={memoryScanning}
            speakingId={speakingId}
            levels={levels}
            onSpeak={(message) => void playAudio(message)}
            onStop={stopAudio}
            onRegenerate={(message) => void handleRegenerate(message)}
            onEditUser={handleEditUser}
          />
          <div ref={scrollAnchorRef} />
        </div>

        <div className="px-3 pb-4 sm:px-4 sm:pb-5">
          <div className="mx-auto max-w-3xl">
            {(notice || pushToTalk.error) && (
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="hud-text mb-2 block w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-left text-[11px] text-primary"
              >
                {pushToTalk.error === "stt-disabled"
                  ? t(language, "sttOff")
                  : pushToTalk.error
                    ? t(language, "sttError")
                    : notice}
              </button>
            )}
            <Composer
              language={language}
              disabled={thinking}
              useShortTerm={settings.useShortTerm}
              {...(draft !== undefined ? { draft } : {})}
              recording={pushToTalk.recording}
              transcribing={pushToTalk.transcribing}
              levels={pushToTalk.levels}
              pushToTalkKey={settings.pushToTalkKey}
              onMicDown={() => void pushToTalk.start()}
              onMicUp={pushToTalk.stop}
              onToggleShortTerm={() =>
                updateSettings({ ...settings, useShortTerm: !settings.useShortTerm })
              }
              onSend={(text, files) => void handleSend(text, files)}
            />
          </div>
        </div>
      </main>

      <MemoryPanel language={language} open={memoryOpen} onOpenChange={setMemoryOpen} />
      <UsagePanel
        language={language}
        open={usageOpen}
        onOpenChange={setUsageOpen}
        availability={availability}
        onRefresh={async () => setAvailability(await loadAvailability(true))}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSettings}
        theme={theme}
        onThemeChange={updateTheme}
      />
    </div>
  );
}
