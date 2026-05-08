"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import LoginScreen from "@/components/LoginScreen";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, setSession } = useAuthStore();

  useEffect(() => {
    // Resolve the current session on mount (handles page refresh)
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));

    // Keep session in sync with Supabase (sign-in, sign-out, token refresh)
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, [setSession]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="h-6 w-6 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
