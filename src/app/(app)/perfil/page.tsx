import { requireAnyUser } from "@/lib/dal";
import { nounOf } from "@/lib/noun";
import PasswordForm, { LicenseForm } from "./form";
import { db } from "@/lib/db";

const ROLE: Record<string, string> = { ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" };

export default async function PerfilPage() {
  const user = await requireAnyUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true } });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Mi cuenta</h1>
      <dl className="card max-w-md divide-y divide-slate-200 p-0">
        {[["Nombre", user.name], ["Correo", user.email], ...(user.clinic.system ? [["Cuenta", "Plataforma (dueño)"]] : [["Rol", ROLE[user.role]], [nounOf(user.clinic.noun).Name, user.clinic.name]])].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="muted">{k}</dt><dd className="text-right text-sm font-semibold text-slate-900">{v}</dd></div>
        ))}
      </dl>
      {!user.clinic.system && user.role !== "RECEPTION" && <LicenseForm license={me.licenseNumber} />}
      <PasswordForm />
    </div>
  );
}
