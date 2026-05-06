/**
 * ML-65: Readout Dashboard — single-page app entry point.
 *
 * ML-327/ML-224: Routes through react-router-dom now so we can support
 * /admin (admin shell) and /login / /no-access (auth flow). The default
 * dashboard at "/" is wrapped in RequireAuth — anonymous visitors are
 * bounced to /login → backend /auth/login → WorkOS AuthKit.
 */

import { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { ReadoutDashboard } from "./components/ReadoutDashboard";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireAdmin } from "./auth/RequireAdmin";
import { Login } from "./pages/Login";
import { NoAccess } from "./pages/NoAccess";
import { CommitteeSettings } from "./pages/CommitteeSettings";
import { AdminHearings } from "./pages/AdminHearings";

function Dashboard() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  return (
    <ReadoutDashboard
      onSelectHearing={setSelectedEventId}
      selectedEventId={selectedEventId}
    />
  );
}

function AdminIndex() {
  // ML-327 admin landing — once the shell is built (ML-328) this will
  // be replaced by a sidebar layout. For now it lists the admin views
  // that exist.
  return (
    <div style={{ padding: 32, fontFamily: "Inter, sans-serif" }}>
      <h1>Admin</h1>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link to="/admin/hearings">Hearings — force-run any pipeline stage</Link>
        </li>
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/no-access" element={<NoAccess />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminIndex />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/hearings"
        element={
          <RequireAdmin>
            <AdminHearings />
          </RequireAdmin>
        }
      />
      <Route
        path="/settings/committees"
        element={
          <RequireAuth>
            <CommitteeSettings />
          </RequireAuth>
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
