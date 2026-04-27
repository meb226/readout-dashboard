/**
 * ML-65: Readout Dashboard — single-page app entry point.
 *
 * ML-327/ML-224: Routes through react-router-dom now so we can support
 * /admin (admin shell) and /login / /no-access (auth flow). The default
 * dashboard at "/" is wrapped in RequireAuth — anonymous visitors are
 * bounced to /login → backend /auth/login → WorkOS AuthKit.
 */

import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ReadoutDashboard } from "./components/ReadoutDashboard";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireAdmin } from "./auth/RequireAdmin";
import { Login } from "./pages/Login";
import { NoAccess } from "./pages/NoAccess";

function Dashboard() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  return (
    <ReadoutDashboard
      onSelectHearing={setSelectedEventId}
      selectedEventId={selectedEventId}
    />
  );
}

function AdminPlaceholder() {
  // ML-327: Admin shell sub-issue (ML-328) will replace this with
  // the actual sidebar + page layout. For now we just confirm auth
  // is wired correctly.
  return (
    <div style={{ padding: 32, fontFamily: "Inter, sans-serif" }}>
      <h1>Admin</h1>
      <p style={{ color: "#666" }}>
        Admin shell — sub-issues of ML-327 will populate this.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/no-access" element={<NoAccess />} />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AdminPlaceholder />
          </RequireAdmin>
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
