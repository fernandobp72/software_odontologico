import ForgotForm from "./form";

export const metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function OlvidePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-teal-800">Recuperar contraseña</h1>
        <p className="muted mb-6">Escribe el correo de tu cuenta y te enviamos un enlace.</p>
        <ForgotForm />
      </div>
    </main>
  );
}
