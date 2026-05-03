import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastsState {
  toasts: Toast[];
  /**
   * Push a toast onto the stack. Auto-dismisses after `durationMs` (default 2500).
   * Returns the toast id so callers can manually dismiss earlier if needed.
   */
  pushToast: (message: string, variant?: ToastVariant, durationMs?: number) => string;
  dismissToast: (id: string) => void;
}

export const useToastsStore = create<ToastsState>((set) => ({
  toasts: [],
  pushToast: (message, variant = 'success', durationMs = 2500) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, variant };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
    return id;
  },
  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
