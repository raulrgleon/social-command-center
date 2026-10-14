import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Accede a tu espacio de trabajo en Mesa para redactar y distribuir publicaciones.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
