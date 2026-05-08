/**
 * Supabase client — lazily initialized on first query call.
 *
 * Setup:
 *   1. Create a project at supabase.com
 *   2. Copy project URL and anon key from Settings → API
 *   3. Add to .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   4. Run supabase/schema.sql in the Supabase SQL editor
 *
 * Why lazy: calling createClient at module load time throws inside the
 * Supabase JS library when env vars are absent, crashing Next.js SSR
 * prerendering during build even when no queries have been made yet.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[FlowOps] Supabase env vars not set. " +
      "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local"
    );
  }

  _client = createClient(url, key);
  return _client;
}

// Proxy keeps the `supabase.from(...)` call-site syntax unchanged while
// deferring client construction until the first actual query.
export const supabase = new Proxy(
  {} as SupabaseClient,
  { get: (_, key: string) => getSupabase()[key as keyof SupabaseClient] }
);
