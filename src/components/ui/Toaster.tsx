"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const TOAST_EVENT = "pa:toast";

/** Fire a passive bottom-right micro-toast from anywhere in the client tree. */
export function toast(message: string, kind: ToastKind = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, kind } }));
}

const DOT: Record<ToastKind, string> = {
  success: "bg-pa-green",
  error: "bg-pa-red",
  info: "bg-primary",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = ++nextId;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2 pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in glass-panel pointer-events-auto flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[t.kind]}`} />
          <p className="text-xs font-medium text-foreground">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
