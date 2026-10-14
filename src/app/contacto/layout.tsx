import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribe a Mesa. El mensaje se guarda en la base de la aplicación.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
