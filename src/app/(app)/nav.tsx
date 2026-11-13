"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/caja", label: "Caja" },
  { href: "/cartera", label: "Cartera" },
];

const admin = (noun: string) => [{ href: "/inicio", label: "Inicio" }, { href: "/equipo", label: "Equipo" }, { href: "/sedes", label: "Sedes" }, { href: "/catalogo", label: "Catálogo" }, { href: "/configuracion", label: `Mi ${noun}` }];
const linksFor = (role: string, platform: boolean, noun: string) => [
  ...base,
  ...(role === "ADMIN" ? [{ href: "/finanzas", label: "Finanzas" }] : role === "RECEPTION" ? [{ href: "/finanzas/gastos", label: "Gastos" }] : [{ href: "/finanzas/mis-pagos", label: "Mis pagos" }]),
  { href: "/laboratorio", label: "Laboratorio" },
  { href: "/recordatorios", label: "Recordatorios" },
  { href: "/inventario", label: "Inventario" },
  ...(role !== "RECEPTION" ? [{ href: "/vademecum", label: "Vademécum" }] : []),
  ...(role === "ADMIN" ? admin(noun) : []),
  ...(platform ? [{ href: "/plataforma", label: "Plataforma" }] : []),
  { href: "/perfil", label: "Mi cuenta" },
];

// «Clientes» (/plataforma y sus fichas) no debe quedar marcado cuando se está en /plataforma/actividad.
const isActive = (path: string, href: string) => (href === "/plataforma" ? path.startsWith(href) && !path.startsWith("/plataforma/actividad") && !path.startsWith("/plataforma/correo") && !path.startsWith("/plataforma/comunicados") : path.startsWith(href));
const platformLinks = [{ href: "/plataforma", label: "Clientes" }, { href: "/plataforma/actividad", label: "Actividad" }, { href: "/plataforma/comunicados", label: "Comunicados" }, { href: "/plataforma/correo", label: "Correo" }, { href: "/perfil", label: "Mi cuenta" }];

export function SideNav({ role, platform, platformOnly = false, noun = "consultorio", invAlerts }: { role: string; platform: boolean; platformOnly?: boolean; noun?: string; invAlerts?: { red: number; yellow: number } }) {
  const path = usePathname();
  const links = platformOnly ? platformLinks : linksFor(role, platform, noun);
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {links.map((l) => {
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? "bg-teal-100 text-teal-900 shadow-[inset_4px_0_0_#e98a45]" : "text-slate-800 hover:bg-slate-200"}`}
          >
            {l.label}
            {l.href === "/inventario" && invAlerts && invAlerts.red + invAlerts.yellow > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${invAlerts.red ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`} title="Productos que necesitan atención">{invAlerts.red + invAlerts.yellow}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ platformOnly = false, moreAlert = false }: { platformOnly?: boolean; moreAlert?: boolean }) {
  const path = usePathname();
  const links = platformOnly ? platformLinks : [...base, { href: "/mas", label: "Más" }];
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map((l) => {
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 py-4 text-center text-sm font-semibold ${active ? "bg-teal-50 text-teal-800 shadow-[inset_0_3px_0_#e98a45]" : "text-slate-800"}`}
          >
            {l.label}
            {l.href === "/mas" && moreAlert && <span className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 align-middle" role="img" aria-label="Hay productos del inventario que necesitan atención" />}
          </Link>
        );
      })}
    </nav>
  );
}
