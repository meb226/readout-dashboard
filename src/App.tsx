/**
 * ML-65: Readout Dashboard — single-page app entry point.
 *
 * ReadoutDashboard handles all pages (dashboard, saved, configure)
 * via internal state. No router needed for beta.
 */

import { useState } from "react";
import { ReadoutDashboard } from "./components/ReadoutDashboard";

export default function App() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  return (
    <ReadoutDashboard
      onSelectHearing={setSelectedEventId}
      selectedEventId={selectedEventId}
    />
  );
}
