import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mesa · la mesa de redacción para todas las redes",
  description: "Un escritorio para redactar una pieza, verla en cada red y distribuirla solo por las vías oficiales.",
  openGraph: { title: "Mesa", description: "Escribe una vez. Cada red conserva su versión.", images: ["/opengraph-image"] },
};

export default function HomePage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-serif text-3xl">Mesa</p>
        <nav className="flex gap-4 text-sm">
          <Link href="/login">Entrar</Link>
          <Link href="/registro">Crear cuenta</Link>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
        <div>
          <h1 className="max-w-xl font-serif text-5xl leading-[1.05] sm:text-7xl">La mesa donde cada red conserva su propia versión.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted">Redactas un original. Instagram no pisa a LinkedIn. Si una plataforma no tiene publicación oficial, Mesa lo dice y te deja el texto listo para copiar.</p>
          <div className="mt-8 flex gap-3">
            <Link href="/registro" className="rounded-full bg-signal px-5 py-3 text-white">Abrir un escritorio</Link>
            <Link href="/login" className="rounded-full border border-line px-5 py-3">Entrar a la demostración</Link>
          </div>
        </div>
        <div className="rounded-[28px] bg-rail p-4 text-rail-ink shadow-[0_24px_60px_rgba(23,32,51,.18)]">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <ul className="space-y-2 text-sm text-rail-muted">
              {["Facebook 0", "Instagram 0", "X 0", "LinkedIn 0"].map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="rounded-2xl bg-[#f6f1e8] p-4 text-[#1c2430]">
              <p className="font-serif text-2xl">El original se queda quieto.</p>
              <p className="mt-3 text-sm leading-6">La versión de cada red se edita sin borrar a las demás. El contador de hoy solo sube cuando una red confirma la publicación.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          <article><h2 className="font-serif text-3xl">Redactar</h2><p className="mt-3 leading-7 text-muted">Manual o con un modelo que configures. Sin clave, el asistente local recorta y ordena, y lo dice.</p></article>
          <article><h2 className="font-serif text-3xl">Ver</h2><p className="mt-3 leading-7 text-muted">La vista cambia al elegir la red: tarjeta, vertical, post corto o ficha profesional.</p></article>
          <article><h2 className="font-serif text-3xl">Enviar</h2><p className="mt-3 leading-7 text-muted">Cada cuenta es una operación. Un fallo no detiene a las demás y un reintento no duplica lo ya publicado.</p></article>
        </div>
      </section>
      <footer className="border-t border-line px-6 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
          <Link href="/contacto">Contacto</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
        </div>
      </footer>
    </main>
  );
}
