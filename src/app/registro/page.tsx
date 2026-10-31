import SignupForm from "./form";

export const metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-teal-800">Crea tu cuenta</h1>
        <p className="muted mb-6">Prueba gratis 30 días. Tú serás el administrador de la cuenta.</p>
        <SignupForm />
      </div>
    </main>
  );
}
