"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BrandIcon } from "@/components/brand-icon";

const LINKS = [
  ["/escritorio", "Escritorio"],
  ["/escritorio/calendario", "Calendario"],
  ["/escritorio/analitica", "Analítica"],
  ["/escritorio/cuentas", "Cuentas"],
  ["/escritorio/historial", "Historial"],
  ["/escritorio/plantillas", "Plantillas"],
  ["/escritorio/campanas", "Campañas"],
  ["/escritorio/ajustes", "Ajustes"],
] as const;

export function AppShell({ name, workspace, children }: { name: string; workspace: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur">
        <Link href="/escritorio" className="font-serif text-2xl tracking-tight">Mesa</Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Secciones">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-sm ${pathname === href ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{workspace}</span>
          <span>{name}</span>
          <button className="rounded-full border border-line px-3 py-1" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Tema</button>
          <button className="rounded-full border border-line px-3 py-1" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }}>Salir</button>
        </div>
      </header>
      <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
        {LINKS.map(([href, label]) => <Link key={href} href={href} className="shrink-0 rounded-full border border-line px-3 py-1 text-sm">{label}</Link>)}
      </div>
      {children}
    </div>
  );
}

export function RailIcon({ id }: { id: string }) {
  return <BrandIcon id={id} className="h-4 w-4" />;
}
