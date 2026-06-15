"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import { useDumpstersStore } from "@/store/dumpsters";
import {
  exportRacks,
  exportDeliveries,
  exportStageDurations,
  exportDumpsters,
} from "@/lib/export";
import { exportFullBackup, parseBackupFile, importFullBackup, type RestoreSummary } from "@/lib/backup";
import PageHeader from "@/components/ui/PageHeader";
import { useAuthStore } from "@/store/auth";

interface ReportCard {
  title:       string;
  description: string;
  detail:      string;
  onExport:    () => void;
  count?:      number;
  countLabel?: string;
  urgent?:     boolean;
}

function ExportCard({ title, description, detail, onExport, count, countLabel, urgent }: ReportCard) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${urgent ? "border-red-200" : "border-stone-200"}`}>
      <div className={`h-0.5 ${urgent ? "bg-red-500" : "bg-orange-500"}`} />
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-stone-800">{title}</p>
            {count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                urgent ? "bg-red-100 text-red-600" : "bg-stone-100 text-stone-500"
              }`}>
                {count} {countLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">{description}</p>
          <p className="text-[11px] text-stone-400">{detail}</p>
        </div>
        <button
          onClick={onExport}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { racks, history, closeAuctionCycle } = useRacksStore();
  const { deliveries }                        = useDeliveriesStore();
  const { zones }                             = useZonesStore();
  const { dumpsters, entries: dumpsterEntries } = useDumpstersStore();

  const activeRacks      = racks.filter((r) => r.status !== "completed").length;
  const activeDeliveries = deliveries.filter((d) => d.status !== "complete").length;
  const completedRacks   = racks.filter((r) => r.status === "completed").length;

  const roleLoading   = useAuthStore((s) => s.roleLoading);
  const role          = useAuthStore((s) => s.activeRole);
  const router        = useRouter();
  const [cycleConfirm, setCycleConfirm] = useState(false);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleResult,  setCycleResult]  = useState<string | null>(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError,   setBackupError]   = useState<string | null>(null);

  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; backup: import("@/lib/backup").BackupFile } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError,   setRestoreError]   = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary[] | null>(null);
  const [fileInputKey,   setFileInputKey]   = useState(0);

  async function handleBackupNow() {
    setBackupLoading(true);
    setBackupError(null);
    try {
      await exportFullBackup();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    setRestoreSummary(null);
    try {
      const text = await file.text();
      const backup = parseBackupFile(text);
      setPendingRestore({ fileName: file.name, backup });
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Couldn't read that file.");
      setFileInputKey((k) => k + 1);
    }
  }

  async function handleConfirmRestore() {
    if (!pendingRestore) return;
    setRestoreLoading(true);
    setRestoreError(null);
    try {
      const summary = await importFullBackup(pendingRestore.backup);
      setRestoreSummary(summary);
      setPendingRestore(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoreLoading(false);
      setFileInputKey((k) => k + 1);
    }
  }

  function handleCancelRestore() {
    setPendingRestore(null);
    setFileInputKey((k) => k + 1);
  }

  async function handleCloseAuctionCycle() {
    setCycleLoading(true);
    const result = await closeAuctionCycle();
    setCycleLoading(false);
    setCycleConfirm(false);
    if (result.ok) {
      setCycleResult(
        result.data === 0
          ? "No completed racks to archive."
          : `Auction cycle closed — ${result.data} rack${result.data === 1 ? "" : "s"} archived.`
      );
    }
  }

  useEffect(() => {
    if (!roleLoading && role !== "admin") router.replace("/");
  }, [role, roleLoading]);

  if (roleLoading || role !== "admin") return null;

  return (
    <div className="space-y-8">

      <PageHeader title="Reports" subtitle="Download operational data as CSV" />

      {/* Operational exports */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Operational</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ExportCard
            title="All Deliveries"
            description="Delivery summary with progress and rack counts."
            detail="Columns: delivery code, consigner, type, status, date, completed, auction date, expected racks, linked, done, progress %"
            onExport={() => exportDeliveries(deliveries, racks)}
            count={activeDeliveries}
            countLabel="active"
          />
          <ExportCard
            title="Dumpsters"
            description="Dumpster activity log — every fill addition and swap, for trash-charge billing."
            detail="Columns: date, dumpster, type, consigner, j-number, percent, logged by"
            onExport={() => exportDumpsters(dumpsters, dumpsterEntries)}
            count={dumpsterEntries.length}
            countLabel="entries"
          />
        </div>
      </div>

      {/* Detailed exports */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Detailed</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ExportCard
            title="All Racks"
            description="Full rack list with current status, priority, zone assignment, and stuck flag."
            detail="Columns: rack code, consigner, status, priority, zone, delivery, created, updated, time in stage, stuck"
            onExport={() => exportRacks(racks, zones, deliveries, history)}
            count={activeRacks}
            countLabel="active"
          />
          <ExportCard
            title="Stage Durations"
            description="Per-rack breakdown of time spent at each pipeline stage. One row per stage per rack."
            detail="Columns: rack code, consigner, stage, entered, exited, duration, threshold, over threshold"
            onExport={() => exportStageDurations(racks, history)}
          />
        </div>
      </div>

      {/* Cycle management */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Cycle Management</h2>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="h-0.5 bg-stone-300" />
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-stone-900">Close Auction Cycle</p>
                  {completedRacks > 0 && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                      {completedRacks} completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500">
                  Archives all completed racks, clearing them from active operational views.
                  Archived racks are preserved for historical reporting.
                </p>
                <p className="text-xs text-stone-400">
                  Run this at the end of each weekly auction cycle.
                </p>
              </div>
              {!cycleConfirm && (
                <button
                  onClick={() => { setCycleConfirm(true); setCycleResult(null); }}
                  className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Close cycle
                </button>
              )}
            </div>

            {cycleConfirm && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs text-amber-800 flex-1">
                  Archive {completedRacks} completed rack{completedRacks !== 1 ? "s" : ""}? This cannot be undone.
                </p>
                <button
                  onClick={handleCloseAuctionCycle}
                  disabled={cycleLoading}
                  className="shrink-0 rounded-md bg-stone-800 px-3 py-1 text-xs font-medium text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                >
                  {cycleLoading ? "Archiving…" : "Confirm"}
                </button>
                <button
                  onClick={() => setCycleConfirm(false)}
                  className="shrink-0 text-xs text-stone-500 hover:text-stone-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {cycleResult && (
              <p className="text-xs text-emerald-700 font-medium">{cycleResult}</p>
            )}
          </div>
        </div>
      </div>

      {/* Backup & restore */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Backup &amp; Restore</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

          {/* Backup */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="h-0.5 bg-orange-500" />
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-stone-900">Download full backup</p>
                <p className="text-xs text-stone-500">
                  Saves a complete snapshot of zones, deliveries, racks, history, notes, consigners,
                  dumpsters, and auction colors as a single JSON file.
                </p>
                <p className="text-xs text-stone-400">
                  Keep these somewhere safe (e.g. cloud drive). A good habit is daily or weekly,
                  and always before a big change like closing the auction cycle.
                </p>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={backupLoading}
                className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {backupLoading ? "Preparing…" : "Back up now"}
              </button>
              {backupError && <p className="text-xs text-red-600 font-medium">{backupError}</p>}
            </div>
          </div>

          {/* Restore */}
          <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
            <div className="h-0.5 bg-red-500" />
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-stone-900">Restore from backup</p>
                <p className="text-xs text-stone-500">
                  Loads a previously downloaded backup file back into the system. Existing records
                  are overwritten; nothing is deleted.
                </p>
                <p className="text-xs text-stone-400">
                  Use this only to recover from data loss — restoring an old backup can overwrite
                  newer changes.
                </p>
              </div>

              {!pendingRestore && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6.293 4.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 10.414V17a1 1 0 11-2 0v-6.586L7.707 11.707a1 1 0 01-1.414-1.414l3-3z" clipRule="evenodd" />
                  </svg>
                  Choose backup file…
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="application/json"
                    onChange={handleRestoreFileSelected}
                    className="hidden"
                  />
                </label>
              )}

              {pendingRestore && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs text-amber-800">
                    Restore <span className="font-semibold">{pendingRestore.fileName}</span> (exported{" "}
                    {new Date(pendingRestore.backup.exportedAt).toLocaleString()})? This will overwrite
                    any matching records currently in FlowOps.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfirmRestore}
                      disabled={restoreLoading}
                      className="rounded-md bg-stone-800 px-3 py-1 text-xs font-medium text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                    >
                      {restoreLoading ? "Restoring…" : "Confirm restore"}
                    </button>
                    <button
                      onClick={handleCancelRestore}
                      disabled={restoreLoading}
                      className="text-xs text-stone-500 hover:text-stone-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {restoreError && <p className="text-xs text-red-600 font-medium">{restoreError}</p>}

              {restoreSummary && (
                <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <p className="text-xs text-emerald-800 font-medium">
                    Restore complete. Reload the page to see the restored data.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-emerald-700 underline hover:text-emerald-900"
                  >
                    Reload now
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
