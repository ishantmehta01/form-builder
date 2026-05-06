import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastsState {
  toasts: Toast[];
  /** Push a toast. Pass durationMs=Infinity for sticky (no auto-dismiss). */
  pushToast: (message: string, variant?: ToastVariant, durationMs?: number, action?: { label: string; onClick: () => void }) => string;
  dismissToast: (id: string) => void;
}

export const useToastsStore = create<ToastsState>((set) => ({
  toasts: [],
  pushToast: (message, variant = 'success', durationMs = 2500, action?) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, variant, ...(action ? { action } : {}) };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (isFinite(durationMs)) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, durationMs);
    }
    return id;
  },
  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
