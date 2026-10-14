"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <h1 className="font-serif text-4xl">No se pudo cargar esta sección.</h1>
      <p className="mt-3 text-muted">{error.message}</p>
      <button className="mt-4 rounded-full border border-line px-4 py-2" onClick={reset}>Reintentar</button>
    </div>
  );
}
