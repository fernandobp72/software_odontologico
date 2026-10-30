import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { logout } from "../login/actions";

const links = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh bg-slate-50 pb-20 md:pb-0">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-semibold text-teal-700">Odontología</span>
        <nav className="hidden gap-4 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-700 hover:text-teal-700">{l.label}</Link>
          ))}
        </nav>
        <form action={logout} className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
          <button className="text-sm text-slate-600 underline">Salir</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex-1 py-4 text-center text-sm font-medium text-slate-700">{l.label}</Link>
        ))}
      </nav>
    </div>
  );
}
