/**
 * Cross-product admin pill strip — mirrors meridianlogic.ai/dashboard
 * so the four admin shells (Overture, Dossier, Readout, App Dashboard
 * hub) feel like one unified shell.
 *
 * Pure presentational component. All links are absolute (cross-domain),
 * since the session cookie is scoped to .meridianlogic.ai so auth
 * carries across the subdomains.
 */

interface Pill {
  id: "overture" | "dossier" | "readout";
  label: string;
  href: string;
}

const PILLS: Pill[] = [
  { id: "overture", label: "Overture", href: "https://admin.meridianlogic.ai/admin" },
  { id: "dossier", label: "Dossier", href: "https://dossier.meridianlogic.ai/admin" },
  { id: "readout", label: "Readout", href: "https://readout.meridianlogic.ai/admin/hearings" },
];

const baseLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 500,
  whiteSpace: "nowrap",
  transition: "background 0.15s, color 0.15s, border-color 0.15s",
};

const backStyle: React.CSSProperties = {
  ...baseLink,
  color: "#6B7280",
  background: "transparent",
  border: "1px solid transparent",
  paddingLeft: 8,
};

const pillStyle: React.CSSProperties = {
  ...baseLink,
  color: "#6B7280",
  background: "transparent",
  border: "1px solid #E5E7EB",
};

const currentStyle: React.CSSProperties = {
  ...baseLink,
  color: "#fff",
  background: "#0039A6",
  border: "1px solid #0039A6",
  pointerEvents: "none",
};

export function AdminPills({ current }: { current: Pill["id"] }) {
  return (
    <nav
      aria-label="Admin navigation"
      style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "0.85rem",
        flexWrap: "wrap",
      }}
    >
      <a href="https://app.meridianlogic.ai/" style={backStyle}>
        <span aria-hidden="true">&larr;</span> Launchpad
      </a>
      {PILLS.map((p) =>
        p.id === current ? (
          <span key={p.id} style={currentStyle}>
            {p.label}
          </span>
        ) : (
          <a key={p.id} href={p.href} style={pillStyle}>
            {p.label}
          </a>
        ),
      )}
    </nav>
  );
}
