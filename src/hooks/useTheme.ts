import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "theme";
const THEME_EVENT = "reelassati:theme-change";

function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : null;
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolvedTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

function snapshot(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleThemeEvent = () => onChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return;
    applyTheme(resolvedTheme());
    onChange();
  };
  const handleSystemTheme = () => {
    if (storedTheme()) return;
    applyTheme(systemTheme());
    onChange();
  };

  window.addEventListener(THEME_EVENT, handleThemeEvent);
  window.addEventListener("storage", handleStorage);
  media.addEventListener("change", handleSystemTheme);
  return () => {
    window.removeEventListener(THEME_EVENT, handleThemeEvent);
    window.removeEventListener("storage", handleStorage);
    media.removeEventListener("change", handleSystemTheme);
  };
}

export function setThemePreference(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function previewTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function restoreThemePreference() {
  if (typeof window === "undefined") return;
  applyTheme(resolvedTheme());
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light");
  const toggleTheme = useCallback(() => {
    setThemePreference(snapshot() === "light" ? "dark" : "light");
  }, []);

  return { theme, toggleTheme, isDark: theme === "dark" };
}
