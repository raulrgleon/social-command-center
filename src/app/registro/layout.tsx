import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Abre un espacio de trabajo en Mesa. La demostración local no requiere claves de redes.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
