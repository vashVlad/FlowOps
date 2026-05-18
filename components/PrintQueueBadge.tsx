"use client";

import Link from "next/link";
import { usePrintQueueStore } from "@/store/printQueue";

export default function PrintQueueBadge() {
  const count = usePrintQueueStore((s) => s.ids.length);
  if (count === 0) return null;
  return (
    <Link
      href="/labels/queue"
      className="fixed bottom-20 right-4 sm:bottom-8 sm:right-6 z-50 flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-stone-800 transition-all duration-150"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      Print queue
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold tabular-nums">
        {count}
      </span>
    </Link>
  );
}
