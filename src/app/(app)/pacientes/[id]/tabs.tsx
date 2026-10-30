"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PatientTabs({ id }: { id: string }) {
  const path = usePathname();
  const tabs = [
    { href: `/pacientes/${id}`, label: "Resumen" },
    { href: `/pacientes/${id}/historia`, label: "Historia clínica" },
    { href: `/pacientes/${id}/plan`, label: "Diagnósticos y plan" },
    { href: `/pacientes/${id}/consentimientos`, label: "Consentimientos" },
  ];
  return (
    <nav aria-label="Secciones del paciente" className="flex gap-1 overflow-x-auto border-b border-slate-300">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-4 px-4 py-3 text-sm font-semibold ${active ? "border-teal-700 text-teal-800" : "border-transparent text-slate-700 hover:text-slate-900"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
