import type { Language, UiMessage } from "@/lib/assistant-client";

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  messages: UiMessage[];
};

export type Settings = {
  language: Language;
  autoSpeak: boolean;
  useShortTerm: boolean;
  useLongTerm: boolean;
  /** Push-to-talk: basili tutulacak tus (KeyboardEvent.code) */
  pushToTalkKey: string;
  /** Push-to-talk acik mi */
  sttEnabled: boolean;
};

const CONVERSATIONS_KEY = "local-assistant.conversations";
const SETTINGS_KEY = "local-assistant.settings";

export const defaultSettings: Settings = {
  language: "tr",
  autoSpeak: true,
  useShortTerm: false,
  useLongTerm: true,
  pushToTalkKey: "ControlRight",
  sttEnabled: true,
};

export function newConversation(language: Language): Conversation {
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: language === "tr" ? "Yeni sohbet" : "New chat",
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...(JSON.parse(raw) as Settings) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
