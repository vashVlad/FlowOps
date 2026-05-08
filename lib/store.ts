// ── Mutation result type ──────────────────────────────────────────────────────
// All store mutations return this shape so callers can branch explicitly.
// Use MutationResult<T>   for mutations that return data  (addDelivery, addRack…)
// Use MutationResult<undefined> for mutations with no return value (setStatus…)

export type MutationResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

export const ok  = <T>(data: T): MutationResult<T> => ({ ok: true,  data });
export const err = (error: string): MutationResult<never> => ({ ok: false, error });

// ── Dev-safe error logger ─────────────────────────────────────────────────────
// Logs in development/test; silent in production.
// Returns the message string so it can be embedded in the error result.

export function logMutationError(action: string, e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (process.env.NODE_ENV !== "production") {
    console.error(`[FlowOps:store] ${action} failed:`, e);
  }
  return message;
}
