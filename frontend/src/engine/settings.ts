import create from "zustand";
import { loadSettings, saveSetting } from "../db/sqlite";

type SettingsState = {
  apiKey: string;
  sidebarWidth: number; // px
  sidebarVisible: boolean;
  setApiKey: (key: string) => void;
  setSidebarWidth: (px: number) => void;
  setSidebarVisible: (v: boolean) => void;
  loadFromDB: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: "",
  sidebarWidth: 380,
  sidebarVisible: true,
  setApiKey: (key) => {
    set({ apiKey: key });
    try {
      saveSetting("api_key", key);
    } catch {
      // ignore until DB is ready
    }
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
  loadFromDB: async () => {
    try {
      const all = loadSettings();
      set({
        apiKey: all["api_key"] ?? "",
        sidebarWidth: Number(all["sidebar_width"] ?? 380) || 380,
        sidebarVisible: (all["sidebar_visible"] ?? "1") !== "0",
      });
    } catch {
      // DB may not be ready yet
    }
  },
}));

export function getApiKey(): string {
  return useSettingsStore.getState().apiKey;
}
