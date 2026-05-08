"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
};

export default function CustomSelect({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const isPlaceholder = !value;

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative w-full">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-orange-500 hover:border-stone-300 transition-colors"
      >
        <span className={`truncate ${isPlaceholder ? "text-stone-400" : "text-stone-900"}`}>
          {selected?.label ?? "Select…"}
        </span>
        <svg className="h-4 w-4 text-stone-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          {/* Desktop backdrop */}
          <div className="fixed inset-0 z-40 hidden sm:block" onClick={() => setOpen(false)} />

          {/* Desktop dropdown — absolute, stays inside card stacking context */}
          <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden sm:block rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
            <div className="max-h-56 overflow-y-auto py-1">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                    o.value === value
                      ? "bg-orange-50 text-orange-600 font-medium"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && (
                    <svg className="h-3.5 w-3.5 text-orange-500 shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile: bottom sheet via portal */}
          {createPortal(
            <div className="sm:hidden">
              <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)} />
              <div className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                  <p className="text-sm font-semibold text-stone-800">{label ?? "Select"}</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                    aria-label="Close"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[60vh] pb-safe">
                  {options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => select(o.value)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 text-sm text-left border-b border-stone-100 last:border-0 active:bg-stone-50 ${
                        o.value === value
                          ? "bg-orange-50 text-orange-600 font-medium"
                          : "text-stone-700"
                      }`}
                    >
                      <span>{o.label}</span>
                      {o.value === value && (
                        <svg className="h-4 w-4 text-orange-500 shrink-0 ml-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
