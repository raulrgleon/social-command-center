import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad", description: "Qué datos guarda Mesa y cómo protege las credenciales de las redes." };

export default function Page() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16 leading-8">
      <h1 className="font-serif text-5xl">Privacidad</h1>
      <p className="mt-6">Guardamos tu nombre, correo, contraseña con Argon2id, el espacio de trabajo, borradores, archivos y el historial de operaciones.</p>
      <p className="mt-4">Los tokens de las redes y la clave de un modelo se cifran en el servidor con AES-256-GCM. No se envían de vuelta al navegador.</p>
      <p className="mt-4">Si configuras OpenAI u otro proveedor, el texto que pidas generar sale de este servidor hacia ese proveedor. Sin clave, el texto no sale.</p>
      <p className="mt-4">El conteo de visitas públicas no guarda IP ni identificadores. La cookie de sesión es HttpOnly.</p>
    </article>
  );
}
