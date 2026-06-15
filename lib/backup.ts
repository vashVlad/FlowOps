/**
 * Full-database backup & restore.
 *
 * Export bundles every operational table into a single JSON snapshot the
 * Admin can download (manually, or on whatever daily/weekly/biweekly cadence
 * fits their routine). Import upserts that snapshot back in by id, so a
 * restore is safe to re-run and won't duplicate rows.
 *
 * Not included: delivery photos (binary files live in Supabase Storage, not
 * in these tables — back up the storage bucket separately if needed) and
 * user accounts/roles (managed via /admin/users, not part of operational data).
 */

import { supabase } from "@/lib/supabase";

export const BACKUP_SCHEMA_VERSION = 1;

// Tables in FK-safe order: parents before children, so import can insert
// in this order and restore in reverse for a clean wipe if ever needed.
const BACKUP_TABLES = [
  "zones",
  "deliveries",
  "dumpsters",
  "racks",
  "rack_events",
  "rack_notes",
  "rack_consigners",
  "dumpster_entries",
  "auction_color_dates",
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];

// Primary key column used for upsert conflict resolution on restore.
const CONFLICT_KEYS: Record<BackupTable, string> = {
  zones: "id",
  deliveries: "id",
  dumpsters: "id",
  racks: "id",
  rack_events: "id",
  rack_notes: "id",
  rack_consigners: "id",
  dumpster_entries: "id",
  auction_color_dates: "color_hex",
};

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  tables: Record<BackupTable, unknown[]>;
}

/** Fetches every table and downloads a single timestamped JSON snapshot. */
export async function exportFullBackup(): Promise<void> {
  const tables = {} as Record<BackupTable, unknown[]>;

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`Export failed on "${table}": ${error.message}`);
    tables[table] = data ?? [];
  }

  const backup: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flowops-backup-${timestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface RestoreSummary {
  table: string;
  rows: number;
}

/**
 * Parses and validates a backup file's text content. Throws if the file
 * isn't a recognized FlowOps backup.
 */
export function parseBackupFile(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const backup = parsed as Partial<BackupFile>;
  if (!backup || typeof backup !== "object" || !backup.tables) {
    throw new Error("That file doesn't look like a FlowOps backup.");
  }
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup version (${backup.schemaVersion ?? "unknown"}). Expected ${BACKUP_SCHEMA_VERSION}.`
    );
  }

  return backup as BackupFile;
}

/**
 * Upserts every table from a parsed backup, in FK-safe order. Existing rows
 * (matched by id) are overwritten; rows that no longer exist locally are
 * left alone — restore never deletes data.
 */
export async function importFullBackup(backup: BackupFile): Promise<RestoreSummary[]> {
  const summary: RestoreSummary[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      summary.push({ table, rows: 0 });
      continue;
    }

    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: CONFLICT_KEYS[table] });
    if (error) throw new Error(`Restore failed on "${table}": ${error.message}`);

    summary.push({ table, rows: rows.length });
  }

  // Restored rows carry explicit rack/delivery codes that may exceed the
  // current sequence counters — bump them so new records don't collide.
  const { error: seqError } = await supabase.rpc("sync_code_sequences");
  if (seqError) throw new Error(`Restore completed but sequence sync failed: ${seqError.message}`);

  return summary;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
