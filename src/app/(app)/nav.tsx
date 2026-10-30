"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/caja", label: "Caja" },
  { href: "/cartera", label: "Cartera" },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {links.map((l) => {
        const active = path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? "bg-teal-700 text-white" : "text-slate-800 hover:bg-slate-200"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-300 bg-white md:hidden">
      {links.map((l) => {
        const active = path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 py-4 text-center text-sm font-semibold ${active ? "bg-teal-50 text-teal-800 shadow-[inset_0_3px_0_#0f766e]" : "text-slate-800"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
