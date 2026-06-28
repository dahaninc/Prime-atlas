"use client";

import { useEffect, useRef } from "react";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function FilterDrawer({ open, onClose, title, children }: FilterDrawerProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — deep black scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/75 transition-opacity duration-[130ms] ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet — #0C0D14 deep zinc panel */}
      <div
        ref={sheetRef}
        className={`fixed left-0 right-0 bottom-0 z-[61] bg-[#0C0D14] rounded-t-[28px]
          transition-transform duration-[150ms] ease-out
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#27272A]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-5 pt-1">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#18181B] flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="px-4 pb-6 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
      </div>
    </>
  );
}
