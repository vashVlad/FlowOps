"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { useRacksStore } from "@/store/racks";
import { timeAgo } from "@/lib/utils";

type ScanStatus = "starting" | "scanning" | "detected" | "denied" | "error";

type RecentScan = {
  rackId: string;
  rackCode: string;
  consignerName: string;
  scannedAt: string;
};

const REGION_ID = "qr-scan-region";

export default function ScanPage() {
  const router = useRouter();
  const racks = useRacksStore((s) => s.racks);
  const racksRef = useRef(racks);
  useEffect(() => { racksRef.current = racks; }, [racks]);

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const cooldownRef = useRef(false);
  const scannerRef = useRef<any>(null);

  const handleDecode = useCallback(
    (text: string) => {
      if (cooldownRef.current) return;

      const match = text.match(/\/racks\/([0-9a-f-]{36})(?:\/|$)/i);
      if (!match) return;

      const rackId = match[1];
      cooldownRef.current = true;
      setStatus("detected");

      const rack = racksRef.current.find((r) => r.id === rackId);
      if (rack) {
        setRecentScans((prev) =>
          [
            {
              rackId,
              rackCode: rack.rackCode,
              consignerName: rack.consignerName,
              scannedAt: new Date().toISOString(),
            },
            ...prev.filter((s) => s.rackId !== rackId),
          ].slice(0, 8)
        );
      }

      setTimeout(() => {
        router.push(`/racks/${rackId}`);
      }, 350);

      setTimeout(() => {
        setStatus("scanning");
        cooldownRef.current = false;
      }, 2000);
    },
    [router]
  );

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w: number, h: number) => {
              const side = Math.round(Math.min(w, h) * 0.65);
              return { width: side, height: side };
            },
          },
          handleDecode,
          () => {}
        );

        if (mounted) setStatus("scanning");
      } catch (e: any) {
        if (!mounted) return;
        const msg = String(e?.message ?? e ?? "").toLowerCase();
        setStatus(msg.includes("permission") || msg.includes("notallowed") ? "denied" : "error");
      }
    }

    start();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => { try { s.clear(); } catch { /* ignore */ } })
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [handleDecode]);

  return (
    <>
      <PageHeader title="Scan Rack" subtitle="Point camera at a rack label QR code" />

      <div className="mt-4 space-y-4">
        {/* Viewfinder */}
        <div className="relative overflow-hidden rounded-2xl bg-stone-950 shadow-sm">
          <div id={REGION_ID} className="w-full" />

          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-950" style={{ minHeight: 280 }}>
              <div className="flex flex-col items-center gap-2.5">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-700 border-t-orange-500" />
                <p className="text-xs text-stone-500">Starting camera…</p>
              </div>
            </div>
          )}

          {status === "detected" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-950/75">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-300">Detected</p>
              </div>
            </div>
          )}

          {status === "denied" && (
            <div className="flex items-center justify-center bg-stone-950 p-10" style={{ minHeight: 280 }}>
              <div className="space-y-2 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-9 w-9 text-stone-600">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <p className="text-sm font-medium text-stone-300">Camera access denied</p>
                <p className="text-xs text-stone-500 max-w-xs">
                  Allow camera access in Settings → Safari → Camera
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center justify-center bg-stone-950 p-10" style={{ minHeight: 280 }}>
              <p className="text-sm text-stone-400">Unable to start camera</p>
            </div>
          )}

          {status === "scanning" && (
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs text-stone-400">
                Scanning…
              </span>
            </div>
          )}
        </div>

        {/* Recent scans */}
        {recentScans.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Scanned this session
            </p>
            <Card padding="p-0">
              <ul className="divide-y divide-stone-100">
                {recentScans.map(({ rackId, rackCode, consignerName, scannedAt }) => (
                  <li key={rackId}>
                    <Link
                      href={`/racks/${rackId}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-stone-900">{rackCode}</p>
                        {consignerName && (
                          <p className="mt-0.5 truncate text-xs text-stone-400">{consignerName}</p>
                        )}
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <span className="text-xs text-stone-400">{timeAgo(scannedAt)}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-stone-300">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
