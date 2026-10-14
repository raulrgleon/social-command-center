"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "Georgia, serif", padding: "48px" }}>
        <h1>Mesa no pudo abrir esta vista.</h1>
        <p>{error.message || "Error inesperado."}</p>
        <button onClick={reset}>Reintentar</button>
      </body>
    </html>
  );
}
