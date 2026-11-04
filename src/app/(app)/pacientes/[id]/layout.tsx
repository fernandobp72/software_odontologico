import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import Link from "next/link";
import PatientTabs from "./tabs";
import { ageText, docText, isPreRegistered } from "@/lib/patient-fields";

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId }, select: { firstName: true, lastName: true, documentType: true, documentNumber: true, birthDate: true, dataConsentAt: true } });
  if (!p) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{p.firstName} {p.lastName}</h1>
          <p className="muted">{docText(p.documentType, p.documentNumber)}{ageText(p.birthDate) ? ` · ${ageText(p.birthDate)}` : ""}</p>
        </div>
        <Link href={`/pacientes/${id}/editar`} className="shrink-0 rounded-lg border border-slate-500 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">Editar</Link>
      </div>
      {(isPreRegistered(p) || !p.dataConsentAt) && (
        <div role="status" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Ficha incompleta</p>
          <p>{isPreRegistered(p) ? "Solo se tiene el nombre y el celular. Faltan el documento y los demás datos: hasta completarlos no se puede firmar evoluciones, consentimientos ni fórmulas, ni registrar cobros." : "Falta registrar la autorización de tratamiento de datos del paciente."}{" "}<Link href={`/pacientes/${id}/editar`} className="font-semibold underline">Completar datos</Link></p>
        </div>
      )}
      <PatientTabs id={id} />
      {children}
    </div>
  );
}
