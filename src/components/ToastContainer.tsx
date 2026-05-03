import { useToastsStore, type ToastVariant } from '@/stores/toasts';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

export function ToastContainer() {
  const toasts = useToastsStore((s) => s.toasts);
  const dismissToast = useToastsStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          data-testid={`toast-${toast.variant}`}
          role="status"
          onClick={() => dismissToast(toast.id)}
          className={`pointer-events-auto px-4 py-2 rounded shadow-lg text-sm font-medium text-white ${VARIANT_STYLES[toast.variant]} cursor-pointer transition-opacity`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
