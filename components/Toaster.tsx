"use client";

import { useToastStore } from "@/store/toast";

const BORDER: Record<string, string> = {
  success: "border-l-emerald-500",
  error:   "border-l-red-500",
  info:    "border-l-stone-400",
};

export default function Toaster() {
  const { toasts, remove } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-5 sm:left-5 sm:right-auto sm:items-start sm:px-0 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl border border-stone-200 bg-white pl-4 pr-3 py-2.5 shadow-lg border-l-4 ${BORDER[t.type] ?? BORDER.info} pointer-events-auto w-full max-w-xs sm:w-auto sm:max-w-sm`}
        >
          <p className="flex-1 text-sm font-medium text-stone-700">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            className="text-stone-300 hover:text-stone-500 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
