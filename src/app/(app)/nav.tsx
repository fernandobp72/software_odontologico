"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/caja", label: "Caja" },
  { href: "/cartera", label: "Cartera" },
];

const admin = [{ href: "/inicio", label: "Inicio" }, { href: "/equipo", label: "Equipo" }, { href: "/sedes", label: "Sedes" }, { href: "/catalogo", label: "Catálogo" }, { href: "/configuracion", label: "Mi consultorio" }];
const linksFor = (role: string, platform: boolean) => [
  ...base,
  { href: "/recordatorios", label: "Recordatorios" },
  ...(role === "ADMIN" ? admin : []),
  ...(platform ? [{ href: "/plataforma", label: "Plataforma" }] : []),
  { href: "/perfil", label: "Mi cuenta" },
];

// «Clientes» (/plataforma y sus fichas) no debe quedar marcado cuando se está en /plataforma/actividad.
const isActive = (path: string, href: string) => (href === "/plataforma" ? path.startsWith(href) && !path.startsWith("/plataforma/actividad") : path.startsWith(href));
const platformLinks = [{ href: "/plataforma", label: "Clientes" }, { href: "/plataforma/actividad", label: "Actividad" }, { href: "/perfil", label: "Mi cuenta" }];

export function SideNav({ role, platform, platformOnly = false }: { role: string; platform: boolean; platformOnly?: boolean }) {
  const path = usePathname();
  const links = platformOnly ? platformLinks : linksFor(role, platform);
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
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ platformOnly = false }: { platformOnly?: boolean }) {
  const path = usePathname();
  const links = platformOnly ? platformLinks : [...base, { href: "/mas", label: "Más" }];
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-300 bg-white md:hidden">
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
          </Link>
        );
      })}
    </nav>
  );
}
