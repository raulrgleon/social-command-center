import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "Esa ruta no existe en Mesa.",
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-2 font-serif text-5xl">Esa página no está en la mesa.</h1>
      <Link href="/" className="mt-6 inline-block text-signal">Volver al inicio</Link>
    </main>
  );
}
