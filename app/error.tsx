"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[FlowOps] Unhandled error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
          <div className="p-6 space-y-3 text-center">
            <p className="text-2xl">⚠️</p>
            <h1 className="text-base font-bold text-stone-900">Something went wrong</h1>
            <p className="text-sm text-stone-500">
              {process.env.NODE_ENV === "development"
                ? error.message
                : "An unexpected error occurred. Please try again."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex-1 rounded-lg border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors text-center"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
