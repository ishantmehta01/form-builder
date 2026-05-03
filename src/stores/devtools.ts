import { create } from 'zustand';

export const DOCK_PREF_KEY = '__devtools.docked';

interface DevToolsState {
  docked: boolean;
  storageOpen: boolean;
  setDocked: (v: boolean) => void;
  setStorageOpen: (v: boolean) => void;
}

export const useDevToolsStore = create<DevToolsState>((set) => ({
  docked: false,
  storageOpen: false,
  setDocked: (v) => {
    try { localStorage.setItem(DOCK_PREF_KEY, String(v)); } catch {}
    set({ docked: v });
  },
  setStorageOpen: (v) => set({ storageOpen: v }),
}));
