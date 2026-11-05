"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4500;

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  info: "border-l-[var(--color-premium-black)]",
  success: "border-l-[#1a7f37]",
  error: "border-l-[var(--color-action-red)]",
};

/** Hook for firing notifications; must be used under <ToastProvider>. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Notification system (§10): bottom-centred toasts that auto-dismiss, are
 * announced politely to assistive tech and can always be dismissed by hand.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  // Auto-dismiss timers by toast id, cleared on manual dismissal and when
  // the provider unmounts, so no timer ever fires into a gone component.
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        window.clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* role="region" makes aria-label valid here (a bare div may not
          carry one), keeping the accessibility tree well-formed for AT
          and agents alike */}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl border-l-4 bg-[var(--color-premium-black)] px-4 py-3 text-sm text-white shadow-lg animate-[ticker-in_250ms_ease-out] ${VARIANT_ACCENT[toast.variant]}`}
          >
            {toast.message}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-1 text-white/70 transition-colors hover:text-white"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
