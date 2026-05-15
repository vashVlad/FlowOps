"use client";

import { AUCTION_COLORS } from "@/lib/tokens";

export default function AuctionColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {AUCTION_COLORS.map(({ hex, label }) => (
        <button
          key={hex}
          type="button"
          title={label}
          onClick={() => onChange(value === hex ? "" : hex)}
          className={`h-6 w-6 rounded-full transition-all ${
            value === hex
              ? "ring-2 ring-offset-2 ring-stone-400 scale-110"
              : "opacity-60 hover:opacity-100"
          }`}
          style={{ backgroundColor: hex }}
        />
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
