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

  // ML-534 telemetry: log the decision RequireAuth makes on every
  // render. The two redirect paths below ARE the prime suspects in
  // the /auth/login -> /auth/callback -> /auth/login loop. Strip
  // after diagnosis.
  console.log("[ml534] RequireAuth decision", {
    pathname: window.location.pathname,
    isLoading,
    sessionIsNull: session === null,
    sessionEmail: session?.email,
    hasReadoutAccess: session?.has_readout_access,
  });

  if (isLoading) {
    return <div style={{ padding: 24, fontFamily: "Inter, sans-serif", color: "#666" }}>Loading…</div>;
  }
  if (!session) {
    console.log("[ml534] RequireAuth -> /login (session is null)");
    return <Navigate to="/login" replace />;
  }
  if (!session.has_readout_access) {
    console.log("[ml534] RequireAuth -> /no-access (entitlement missing)", {
      sessionKeys: Object.keys(session),
    });
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}
