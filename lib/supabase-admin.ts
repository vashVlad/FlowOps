// Server-side only — uses the service role key which bypasses RLS.
// Never import this file from client components.
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[FlowOps] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Add it to .env.local (never prefix with NEXT_PUBLIC_)."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
