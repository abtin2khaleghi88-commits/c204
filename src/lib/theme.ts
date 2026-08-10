/**
 * Tema (dark mode) yonetimi. Ayarlardan "light | dark | system" secilir;
 * "system" isletim sisteminin temasini otomatik takip eder.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "local-assistant.theme";

export function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  // C204 HUD temasi koyu modda tasarlandi: varsayilan "dark".
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "dark";
}

export function saveTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const dark = mode === "dark" || (mode === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** "system" modunda OS temasi degisimini dinler. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
