import LoginForm from "./form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Odontología</h1>
        <p className="mb-6 text-sm text-slate-500">Ingresa a tu consultorio</p>
        <LoginForm />
      </div>
    </main>
  );
}
