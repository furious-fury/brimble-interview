import { useToast } from "../hooks/useToast.js";
import { Loader2, CheckCircle, XCircle, Info, X } from "lucide-react";

const toastStyles = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  loading: "bg-slate-50 border-slate-200 text-slate-700",
};

const iconMap = {
  info: Info,
  success: CheckCircle,
  error: XCircle,
  loading: Loader2,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-sm border px-4 py-3 shadow-lg transition-all ${toastStyles[toast.type]}`}
          >
            <Icon
              className={`h-5 w-5 flex-shrink-0 ${
                toast.type === "loading" ? "animate-spin" : ""
              }`}
            />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 rounded-sm p-1 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
