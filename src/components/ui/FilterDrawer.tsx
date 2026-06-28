"use client";

import { useEffect, useRef } from "react";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Robinhood-style bottom sheet drawer.
 * Slide-up animation < 150ms. Backdrop dismisses.
 * Safe-area aware. Scroll-locked when open.
 */
export function FilterDrawer({ open, onClose, title, children }: FilterDrawerProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-[120ms] ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed left-0 right-0 bottom-0 z-[61] bg-background rounded-t-2xl border-t border-border shadow-2xl
          transition-transform duration-[140ms] ease-out
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
      </div>
    </>
  );
}
