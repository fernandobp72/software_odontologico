import LoginForm from "./form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-teal-800">Odontología</h1>
        <p className="muted mb-6">Ingresa a tu consultorio</p>
        <LoginForm />
      </div>
    </main>
  );
}
