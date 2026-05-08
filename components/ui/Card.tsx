import type { ReactNode } from "react";

export default function Card({
  children,
  className = "",
  padding = "px-4 py-4",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white shadow-sm ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
      {children}
    </p>
  );
}
