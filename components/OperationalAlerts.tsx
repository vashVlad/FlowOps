import Link from "next/link";

export interface AlertItem {
  severity: "critical" | "warning";
  message:  string;
  detail?:  string;
  href?:    string;
}

export function OperationalAlerts({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const dot    = alert.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-400";
        const card   = alert.severity === "critical"
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50";
        const inner  = (
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-800">{alert.message}</p>
              {alert.detail && <p className="text-[10px] text-stone-500 mt-0.5">{alert.detail}</p>}
            </div>
          </div>
        );

        return alert.href ? (
          <Link key={i} href={alert.href}
            className={`block rounded-lg border px-3.5 py-2.5 hover:opacity-80 transition-opacity ${card}`}>
            {inner}
          </Link>
        ) : (
          <div key={i} className={`rounded-lg border px-3.5 py-2.5 ${card}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
