/**
 * Thin login page. The actual auth happens in WorkOS AuthKit's
 * hosted UI; this component just bounces the browser there via
 * the backend's /auth/login redirect endpoint.
 *
 * Why redirect through the backend instead of straight to WorkOS:
 * the backend builds the authorize URL with the correct
 * client_id and redirect_uri so the SPA doesn't need to know any
 * WorkOS-specific config.
 */

import { useEffect } from "react";

// Relative URL: navigates to /auth/login on the current origin.
// Vercel rewrites in vercel.json proxy this to the Railway backend
// in production; vite.config.ts proxies it to localhost:8000 in dev.
export function Login() {
  useEffect(() => {
    window.location.href = "/auth/login";
  }, []);
  return (
    <div style={{ padding: 48, fontFamily: "Inter, sans-serif", color: "#444" }}>
      Redirecting to sign in…
    </div>
  );
}
