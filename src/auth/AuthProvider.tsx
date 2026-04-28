/**
 * ML-327/ML-224: Auth context that bootstraps from /api/auth/check.
 *
 * On mount, calls the backend with credentials: 'include' so the
 * shared .meridianlogic.ai session cookie travels along. Hands the
 * result to the rest of the app via context so RequireAuth and
 * RequireAdmin can decide what to render.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

// Same-origin always. In production the SPA is served from
// readout.meridianlogic.ai and Vercel rewrites in vercel.json proxy
// /api/* and /auth/* to the Railway backend, keeping cookies same-origin.
// In dev, vite.config.ts proxies the same paths to localhost:8000.
// Hardcoded "" (instead of reading VITE_API_URL) so a stale env var
// pointing at the Railway hostname can't bake a cross-origin URL into
// the bundle and break the cookie flow.
const API_BASE = "";

export interface AuthSession {
  authed: true;
  email: string;
  name: string;
  is_admin: boolean;
  has_readout_access: boolean;
}

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isAdmin: false,
});

async function fetchSession(): Promise<AuthSession | null> {
  const res = await fetch(`${API_BASE}/api/auth/check`, {
    credentials: "include",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchSession,
    // Don't retry — a 401 is an answer, not a transient failure.
    retry: false,
    // Cache for 5 minutes so internal navigation doesn't re-fetch.
    staleTime: 5 * 60 * 1000,
  });

  const session = data ?? null;
  const value: AuthContextValue = {
    session,
    isLoading,
    isAdmin: session?.is_admin ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
