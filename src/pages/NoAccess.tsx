/**
 * Landing page for users who authenticated successfully but don't
 * have a Readout entitlement. They keep their .meridianlogic.ai
 * SSO session — they just can't use this app — so the primary CTA
 * is to head back to the picker and try one they DO have access to.
 */

const PICKER_URL =
  (import.meta as any).env?.VITE_PICKER_URL || "https://app.meridianlogic.ai";

export function NoAccess() {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "120px auto",
        padding: 32,
        fontFamily: "Inter, sans-serif",
        color: "#222",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>No Readout access</h1>
      <p style={{ color: "#666", lineHeight: 1.5, marginBottom: 24 }}>
        Your account is signed in across Meridian Logic, but doesn't have a
        Readout subscription yet. Head back to the picker to use a different
        Meridian app, or contact us to add Readout to your plan.
      </p>
      <a
        href={PICKER_URL}
        style={{
          display: "inline-block",
          padding: "10px 20px",
          background: "#0039A6",
          color: "white",
          borderRadius: 6,
          textDecoration: "none",
        }}
      >
        Back to picker
      </a>
    </div>
  );
}
