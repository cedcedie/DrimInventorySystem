"use client";

import { useEffect } from "react";

/** Only fires if the ROOT layout itself throws (theme/providers/fonts) — this
 * replaces <html>/<body> entirely, so it must not depend on ThemeRegistry,
 * MUI, or any provider that could itself be the thing that broke. Plain
 * inline styles only. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#212B36",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>The app failed to load</h1>
        <p style={{ fontSize: 14, color: "#646B72", maxWidth: 420, margin: 0 }}>
          Something broke before the DRIM panel could start. Try reloading — if this keeps happening,
          contact whoever manages your DRIM account.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "#9AA1A9", fontFamily: "monospace", margin: 0 }}>
            Ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: "#FE9F43",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
