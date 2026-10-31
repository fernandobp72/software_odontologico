import Link from "next/link";
import { nounOf } from "@/lib/noun";
import { requireAnyUser } from "@/lib/dal";
import { logout } from "../../login/actions";

export default async function MasPage() {
  const user = await requireAnyUser();
  const items = user.clinic.system ? [["/plataforma", "Clientes"], ["/perfil", "Mi cuenta"]] : [
    ...(user.role === "ADMIN" ? [["/inicio", "Inicio guiado"], ["/equipo", "Equipo"], ["/sedes", "Sedes"], ["/catalogo", "Catálogo y tarifas"], ["/configuracion", `Mi ${nounOf(user.clinic.noun).name}`]] : []),
    ...(user.isPlatformAdmin ? [["/plataforma", "Plataforma"]] : []),
    ["/recordatorios", "Recordatorios"],
    ["/perfil", "Mi cuenta"],
  ];
  return (
    <div className="space-y-4">
      <h1 className="page-title">Más</h1>
      <ul className="space-y-2">
        {items.map(([href, label]) => (
          <li key={href}><Link href={href} className="card block font-semibold text-slate-900 hover:border-teal-700">{label}</Link></li>
        ))}
      </ul>
      <form action={logout}><button className="btn-secondary w-full">Salir</button></form>
    </div>
  );
}
