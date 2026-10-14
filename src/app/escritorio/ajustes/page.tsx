import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Ajustes" };

export default function Page() {
  return (
    <div className="p-4 lg:p-8">
      <h1 className="font-serif text-4xl">Ajustes</h1>
      <p className="mt-2 max-w-2xl text-muted">La clave del modelo se cifra antes de guardarse. El navegador no la recibe de vuelta.</p>
      <SettingsForm />
    </div>
  );
}
