import { createContext, useContext, useCallback } from "react";

export type ToastType = "info" | "success" | "error" | "loading";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function useToastActions() {
  const { addToast, removeToast, updateToast } = useToast();

  const showLoading = useCallback(
    (message: string) => addToast(message, "loading", 0),
    [addToast]
  );

  const showSuccess = useCallback(
    (message: string, duration = 3000) =>
      addToast(message, "success", duration),
    [addToast]
  );

  const showError = useCallback(
    (message: string, duration = 5000) => addToast(message, "error", duration),
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration = 3000) => addToast(message, "info", duration),
    [addToast]
  );

  return {
    showLoading,
    showSuccess,
    showError,
    showInfo,
    removeToast,
    updateToast,
  };
}

export { ToastContext };
