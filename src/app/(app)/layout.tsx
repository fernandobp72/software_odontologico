import { requireUser } from "@/lib/dal";
import { logout } from "../login/actions";
import { BottomNav, SideNav } from "./nav";

const daysLeft = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));

const ROLE: Record<string, string> = { ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-300 bg-white p-4 md:flex">
        <p className="mb-6 text-lg font-bold text-teal-800">Odontología</p>
        <SideNav role={user.role} platform={user.isPlatformAdmin} />
        <div className="mt-auto space-y-2 border-t border-slate-300 pt-4">
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="muted">{ROLE[user.role]}</p>
          <form action={logout}><button className="btn-secondary w-full">Salir</button></form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-white px-4 py-3 md:hidden">
          <span className="font-bold text-teal-800">Odontología</span>
          <form action={logout} className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-800">{user.name}</span>
            <button className="btn-secondary min-h-10 px-3">Salir</button>
          </form>
        </header>
        {user.clinic.status === "TRIAL" && user.clinic.trialEndsAt && (
          <p className="bg-blue-100 px-4 py-2 text-center text-sm font-semibold text-blue-900">
            Prueba gratuita: {daysLeft(user.clinic.trialEndsAt)} días restantes
          </p>
        )}
        <main className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
