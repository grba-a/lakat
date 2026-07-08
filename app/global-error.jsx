"use client";

// Global error boundary zamjenjuje CIJELI root layout (pa i <html>/<body>) —
// next/font varijable i globals.css možda nisu učitani, zato sve inline.
export default function GlobalError({ reset }) {
  return (
    <html lang="hr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 1.25rem",
          textAlign: "center",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <p
          style={{
            fontSize: "3.5rem",
            lineHeight: 1,
            fontWeight: 800,
            color: "#f87171",
            margin: 0,
          }}
        >
          Ups.
        </p>
        <h1
          style={{
            marginTop: "1rem",
            fontSize: "1.5rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          Nešto je puklo, i to ozbiljno.
        </h1>
        <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#8b8b94" }}>
          Probaj ponovno učitati.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "2.5rem",
            height: "4rem",
            width: "100%",
            maxWidth: "20rem",
            borderRadius: "1.25rem",
            border: "none",
            background: "#4ade80",
            color: "#000",
            fontSize: "1.25rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          Probaj opet
        </button>
      </body>
    </html>
  );
}
