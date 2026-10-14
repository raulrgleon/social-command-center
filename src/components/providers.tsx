"use client";

import { ThemeProvider } from "next-themes";
import { useSyncExternalStore, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <CookieNotice />
    </ThemeProvider>
  );
}

function CookieNotice() {
  const [tick, setTick] = useState(0);
  const consent = useSyncExternalStore(
    () => () => {},
    () => {
      void tick;
      return localStorage.getItem("mesa-consent");
    },
    () => "pending",
  );
  if (consent) return null;
  const choose = (value: string) => {
    localStorage.setItem("mesa-consent", value);
    if (value === "accepted" && window.location.pathname === "/") {
      navigator.sendBeacon("/api/public/view", new Blob([JSON.stringify({ path: "/" })], { type: "application/json" }));
    }
    setTick((value) => value + 1);
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel p-4 shadow-[0_-8px_30px_rgba(23,32,51,0.08)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Mesa guarda una cookie de sesión para mantenerte dentro. El conteo de visitas de las páginas públicas solo se activa si lo aceptas.
        </p>
        <div className="flex gap-2">
          <button className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => choose("denied")}>
            Solo esenciales
          </button>
          <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper" onClick={() => choose("accepted")}>
            Aceptar conteo
          </button>
        </div>
      </div>
    </div>
  );
}
