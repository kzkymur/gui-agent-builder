import create from "zustand";
import { loadSettings, saveSetting } from "../db/sqlite";

type SettingsState = {
  apiKey: string; // legacy, global fallback
  apiKeys: Record<string, string>; // per-provider keys by id
  travilyApiKey?: string; // Tavily (web search) key
  sidebarWidth: number; // px
  sidebarVisible: boolean;
  footerHeight: number; // px
  setApiKey: (key: string) => void;
  setApiKeyFor: (providerId: string, key: string) => void;
  setTravilyApiKey: (key: string) => void;
  setSidebarWidth: (px: number) => void;
  setSidebarVisible: (v: boolean) => void;
  setFooterHeight: (px: number) => void;
  loadFromDB: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: "",
  apiKeys: {},
  travilyApiKey: "",
  sidebarWidth: 380,
  sidebarVisible: true,
  footerHeight: 200,
  setApiKey: (key) => {
    set({ apiKey: key });
    try {
      saveSetting("api_key", key);
    } catch {
      // ignore until DB is ready
    }
  },
  setApiKeyFor: (providerId, key) => {
    const next = { ...get().apiKeys, [providerId]: key };
    set({ apiKeys: next });
    try {
      saveSetting("api_keys", JSON.stringify(next));
    } catch {}
  },
  setTravilyApiKey: (key) => {
    set({ travilyApiKey: key });
    try {
      saveSetting("tavily_api_key", key);
    } catch {}
  },
  setSidebarWidth: (px) => {
    const clamped = Math.max(240, Math.min(720, Math.round(px)));
    set({ sidebarWidth: clamped });
    try {
      saveSetting("sidebar_width", String(clamped));
    } catch {}
  },
  setSidebarVisible: (v) => {
    set({ sidebarVisible: v });
    try {
      saveSetting("sidebar_visible", v ? "1" : "0");
    } catch {}
  },
  setFooterHeight: (px) => {
    const clamped = Math.max(100, Math.min(600, Math.round(px)));
    set({ footerHeight: clamped });
    try {
      saveSetting("footer_height", String(clamped));
    } catch {}
  },
  loadFromDB: async () => {
    try {
      const all = loadSettings();
      set({
        apiKey: all.api_key ?? "",
        apiKeys: (() => {
          try {
            const parsed = JSON.parse(all.api_keys ?? "{}");
            return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
          } catch {
            return {};
          }
        })(),
        travilyApiKey: all.tavily_api_key ?? "",
        sidebarWidth: Number(all.sidebar_width ?? 380) || 380,
        sidebarVisible: (all.sidebar_visible ?? "1") !== "0",
        footerHeight: Number(all.footer_height ?? 200) || 200,
      });
    } catch {
      // DB may not be ready yet
    }
  },
}));

export function getApiKey(providerId?: string): string {
  const s = useSettingsStore.getState();
  if (providerId && s.apiKeys[providerId]) return s.apiKeys[providerId];
  return s.apiKey;
}
