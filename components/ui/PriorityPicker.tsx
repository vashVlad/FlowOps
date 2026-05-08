import type { Priority } from "@/types";

const OPTIONS: { value: Priority; label: string; idle: string; active: string }[] = [
  {
    value:  "high",
    label:  "High",
    idle:   "border-stone-200 text-stone-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700",
    active: "border-amber-300 bg-amber-50 text-amber-700",
  },
  {
    value:  "normal",
    label:  "Normal",
    idle:   "border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700",
    active: "border-stone-300 bg-stone-100 text-stone-700",
  },
  {
    value:  "low",
    label:  "Low",
    idle:   "border-stone-200 text-stone-400 hover:bg-stone-50",
    active: "border-stone-200 bg-stone-50 text-stone-400",
  },
];

export default function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Priority">
      {OPTIONS.map(({ value: v, label, idle, active }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
            value === v ? active : idle
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
