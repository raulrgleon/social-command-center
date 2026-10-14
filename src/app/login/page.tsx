"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("demo@mesa.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <form className="mt-8 grid gap-3" onSubmit={async (event) => {
      event.preventDefault();
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "No se pudo entrar."); return; }
      router.push(params.get("next") || "/escritorio");
      router.refresh();
    }}>
      <label>Correo<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      <label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button className="rounded-full bg-ink px-4 py-3 text-paper">Entrar</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link href="/" className="font-serif text-3xl">Mesa</Link>
      <h1 className="mt-8 font-serif text-5xl">Entrar</h1>
      <p className="mt-3 text-muted">La demostración local usa demo@mesa.local y la contraseña definida al sembrar la base.</p>
      <Suspense><Form /></Suspense>
      <p className="mt-6 text-sm"><Link href="/registro">Crear una cuenta</Link></p>
    </main>
  );
}
