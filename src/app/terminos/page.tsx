import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos", description: "Condiciones de uso de Mesa, el centro de mando para redes sociales." };

export default function Page() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16 leading-8">
      <h1 className="font-serif text-5xl">Términos</h1>
      <p className="mt-6">Mesa es una herramienta para preparar y, cuando la plataforma lo permite, enviar publicaciones con las APIs oficiales. No promete publicación automática en redes que no la ofrecen.</p>
      <p className="mt-4">Eres responsable del contenido que escribes y de las cuentas que conectas. Una publicación confirmada por la red queda fuera del control de Mesa.</p>
      <p className="mt-4">La demostración incluida no publica en redes reales. Cámbiala o elimínala antes de un despliegue público.</p>
    </article>
  );
}
