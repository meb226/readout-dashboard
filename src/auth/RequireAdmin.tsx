/**
 * ML-327: Route guard for admin-only pages (e.g. /admin/podcast).
 *
 * Composes with RequireAuth — anything inside RequireAdmin is also
 * inside RequireAuth, so we only need to check the admin bit here.
 */

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 24, fontFamily: "Inter, sans-serif", color: "#666" }}>Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!session.is_admin) {
    return <Navigate to="/no-access" replace />;
  }
  return <>{children}</>;
}
