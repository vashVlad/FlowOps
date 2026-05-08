import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-2.5">
        <span className="block h-6 w-1 rounded-full bg-orange-600 shrink-0 mt-0.5" />
        <div>
          <h1 className="text-xl font-bold text-stone-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
