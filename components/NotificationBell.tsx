"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotificationsStore } from "@/store/notifications";
import { timeAgo } from "@/lib/utils";
import { NOTIFICATION_DOT } from "@/lib/tokens";

export default function NotificationBell() {
  const { notifications, markAllRead, dismiss } = useNotificationsStore();
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  function toggle() {
    if (!open) markAllRead();
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative flex items-center justify-center rounded-lg p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="
            fixed top-14 right-3 z-50 w-[268px] rounded-xl
            border border-stone-200 bg-white shadow-lg overflow-hidden
            sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:w-[268px] sm:shadow-md
          ">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Alerts</p>
              {notifications.length > 0 && (
                <button
                  onClick={() => notifications.forEach((n) => dismiss(n.id))}
                  className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-medium text-stone-500">All clear</p>
                <p className="text-[11px] text-stone-400 mt-0.5">No active alerts.</p>
              </div>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {notifications.map((n, i) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-stone-50 transition-colors ${
                      i > 0 ? "border-t border-stone-100" : ""
                    }`}
                  >
                    <span className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${NOTIFICATION_DOT[n.type] ?? "bg-stone-400"}`} />
                    <div className="flex-1 min-w-0">
                      {n.rackId ? (
                        <Link
                          href={`/racks/${n.rackId}`}
                          onClick={() => setOpen(false)}
                          className="text-[11px] font-medium text-stone-700 hover:text-orange-600 transition-colors leading-snug block"
                        >
                          {n.message}
                        </Link>
                      ) : (
                        <p className="text-[11px] font-medium text-stone-700 leading-snug">{n.message}</p>
                      )}
                      <p className="text-[10px] text-stone-400 mt-0.5">{timeAgo(n.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      aria-label="Dismiss"
                      className="text-stone-300 hover:text-stone-500 transition-colors shrink-0 mt-[3px]"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
