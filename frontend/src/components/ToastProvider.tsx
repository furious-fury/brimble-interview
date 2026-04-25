import { useState, useCallback, ReactNode } from "react";
import { ToastContext, type Toast } from "../hooks/useToast.js";
import { ToastContainer } from "./ToastContainer.js";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast["type"], duration = 3000) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      // Auto-remove for non-loading toasts
      if (type !== "loading" && duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback(
    (id: string, updates: Partial<Omit<Toast, "id">>) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      );

      // Auto-remove if updating to success/error with duration
      if (
        (updates.type === "success" || updates.type === "error") &&
        updates.duration &&
        updates.duration > 0
      ) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, updates.duration);
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}
