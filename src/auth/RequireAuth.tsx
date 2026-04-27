/**
 * ML-327/ML-224: Route guard that requires an authenticated session.
 *
 * Wraps protected routes. While the AuthProvider is still loading,
 * renders a minimal placeholder (avoids flicker). On unauthenticated,
 * sends the user to /login which itself bounces them to the backend
 * /auth/login → WorkOS hosted UI.
 */

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 24, fontFamily: "Inter, sans-serif", color: "#666" }}>Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!session.has_readout_access) {
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}
