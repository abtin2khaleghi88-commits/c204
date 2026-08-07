import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Composer, type PendingFile } from "@/components/assistant/Composer";
import { ConversationSidebar } from "@/components/assistant/ConversationSidebar";
import { MemoryPanel } from "@/components/assistant/MemoryPanel";
import { MessageList } from "@/components/assistant/MessageList";
import { SettingsDialog } from "@/components/assistant/SettingsDialog";
import { sendChat, speak, stopSpeaking, type UiMessage } from "@/lib/assistant-client";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yerel AI Asistan · Offline Sohbet Arayüzü" },
      {
        name: "description",
        content:
          "Tamamen yerel çalışan AI + TTS sohbet arayüzü: dosya paylaşımı, Türkçe/İngilizce dil desteği ve hafıza yönetimi paneli.",
      },
      { property: "og:title", content: "Yerel AI Asistan · Offline Sohbet Arayüzü" },
      {
        property: "og:description",
        content:
          "Yerel AI sunucunuza bağlanan, sesli yanıt veren ve hafıza yönetimi sunan sohbet arayüzü.",
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
  const [memoryScanning, setMemoryScanning] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  // Ilk yukleme: yerel depodan geri yukle
  useEffect(() => {
    const storedSettings = loadSettings();
    const stored = loadConversations();
    const list = stored.length > 0 ? stored : [newConversation(storedSettings.language)];
    setSettings(storedSettings);
    setConversations(list);
    setActiveId(list[0]!.id);
  }, []);

  const language = settings.language;
  const active = conversations.find((conversation) => conversation.id === activeId);

  const persist = (next: Conversation[]) => {
    setConversations(next);
    saveConversations(next);
  };

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const playAudio = async (message: UiMessage) => {
    stopRef.current?.();
    stopSpeaking();
    setSpeakingId(message.id);
    try {
      stopRef.current = await speak(message.content, language);
    } catch {
      setSpeakingId(null);
    }
  };

  const stopAudio = () => {
    stopRef.current?.();
    stopSpeaking();
    stopRef.current = null;
    setSpeakingId(null);
  };

  const handleSend = async (text: string, files: PendingFile[]) => {
    if (!active) return;

    const userMessage: UiMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      content: text || (language === "tr" ? "(dosya eklendi)" : "(file attached)"),
      createdAt: new Date().toISOString(),
      attachments: files.map((file) => ({ name: file.name, size: file.size })),
    };

    const withUser = conversations.map((conversation) =>
      conversation.id === active.id
        ? {
            ...conversation,
            title:
              conversation.messages.length === 0
                ? userMessage.content.slice(0, 40)
                : conversation.title,
            messages: [...conversation.messages, userMessage],
          }
        : conversation,
    );
    persist(withUser);

    const useMemory = settings.useShortTerm || settings.useLongTerm;
    setThinking(true);
    setMemoryScanning(useMemory);

    try {
      const history = [...active.messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const reply = await sendChat({
        messages: history,
        language,
        useShortTerm: settings.useShortTerm,
        useLongTerm: settings.useLongTerm,
        attachments: files.map((file) => ({ name: file.name, excerpt: file.excerpt })),
      });

      const assistantMessage: UiMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: reply.content,
        createdAt: new Date().toISOString(),
      };

      const withAssistant = withUser.map((conversation) =>
        conversation.id === active.id
          ? { ...conversation, messages: [...conversation.messages, assistantMessage] }
          : conversation,
      );
      persist(withAssistant);

      if (settings.autoSpeak) void playAudio(assistantMessage);
    } finally {
      setThinking(false);
      setMemoryScanning(false);
    }
  };

  const handleNew = () => {
    const conversation = newConversation(language);
    persist([conversation, ...conversations]);
    setActiveId(conversation.id);
  };

  const handleDelete = (id: string) => {
    const next = conversations.filter((conversation) => conversation.id !== id);
    const list = next.length > 0 ? next : [newConversation(language)];
    persist(list);
    if (id === activeId) setActiveId(list[0]!.id);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <ConversationSidebar
        language={language}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onOpenMemory={() => setMemoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <h2 className="truncate text-sm font-medium">
            {active?.title ?? t(language, "newChat")}
          </h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-secondary-foreground">
            {language === "tr" ? "Türkçe" : "English"}
          </span>
        </header>

        <MessageList
          language={language}
          messages={active?.messages ?? []}
          thinking={thinking}
          memoryScanning={memoryScanning}
          speakingId={speakingId}
          onSpeak={(message) => void playAudio(message)}
          onStop={stopAudio}
        />

        <div className="px-4 pb-5">
          <div className="mx-auto max-w-3xl">
            <Composer
              language={language}
              disabled={thinking}
              useShortTerm={settings.useShortTerm}
              onToggleShortTerm={() =>
                updateSettings({ ...settings, useShortTerm: !settings.useShortTerm })
              }
              onSend={(text, files) => void handleSend(text, files)}
            />
          </div>
        </div>
      </main>

      <MemoryPanel language={language} open={memoryOpen} onOpenChange={setMemoryOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSettings}
      />
    </div>
  );
}
