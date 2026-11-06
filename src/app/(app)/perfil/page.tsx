import { requireAnyUser } from "@/lib/dal";
import { nounOf } from "@/lib/noun";
import PasswordForm, { EmailForm, ProfileForm } from "./form";
import { db } from "@/lib/db";

const ROLE: Record<string, string> = { ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" };

export default async function PerfilPage() {
  const user = await requireAnyUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true, phone: true, email: true } });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Mi cuenta</h1>
      <dl className="card max-w-md divide-y divide-slate-200 p-0">
        {[["Nombre", user.name], ["Correo", user.email], ...(user.clinic.system ? [["Cuenta", "Plataforma (dueño)"]] : [["Rol", ROLE[user.role]], [nounOf(user.clinic.noun).Name, user.clinic.name]])].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="muted">{k}</dt><dd className="text-right text-sm font-semibold text-slate-900">{v}</dd></div>
        ))}
      </dl>
      <ProfileForm key={`${user.name}${me.phone}`} name={user.name} phone={me.phone} license={me.licenseNumber} clinical={!user.clinic.system && user.role !== "RECEPTION"} />
      <EmailForm key={me.email} email={me.email} />
      {!user.clinic.system && user.role !== "RECEPTION" && (
        <a href="/perfil/sello" className="card flex max-w-md items-center justify-between gap-3 no-underline">
          <span><span className="block font-semibold text-slate-900">Mi sello digital</span><span className="muted">Firma tus evoluciones y fórmulas con tu huella o clave. Reporta si pierdes un dispositivo.</span></span>
          <span aria-hidden className="text-teal-800">→</span>
        </a>
      )}
      <PasswordForm />
    </div>
  );
}
