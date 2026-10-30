import { logout } from "../login/actions";

export default function SuspendidaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold">Cuenta suspendida</h1>
        <p className="text-slate-800">El acceso de este consultorio está suspendido. Tus datos se conservan. Comunícate con soporte para reactivarlo.</p>
        <form action={logout}><button className="btn-secondary w-full">Salir</button></form>
      </div>
    </main>
  );
}
