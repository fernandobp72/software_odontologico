"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/gastos", label: "Gastos" },
  { href: "/finanzas/por-pagar", label: "Por pagar" },
  { href: "/finanzas/profesionales", label: "Profesionales" },
  { href: "/finanzas/laboratorios", label: "Laboratorios" },
  { href: "/finanzas/empleados", label: "Empleados" },
  { href: "/finanzas/resultados", label: "Resultados" },
  { href: "/finanzas/a-quien-le-pago", label: "A quién le pago" },
  { href: "/finanzas/ajustes", label: "Ajustes" },
];

// Pestañas de Finanzas. Recepción solo ve Gastos, así que no se muestran.
export default function FinanceTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Finanzas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {TABS.map((t) => {
        const active = t.href === "/finanzas" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-400 bg-white text-slate-900"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
