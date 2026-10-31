import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import PatientTabs from "./tabs";
import { ageText } from "@/lib/patient-fields";

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId }, select: { firstName: true, lastName: true, documentType: true, documentNumber: true, birthDate: true } });
  if (!p) notFound();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">{p.firstName} {p.lastName}</h1>
        <p className="muted">{p.documentType} {p.documentNumber}{ageText(p.birthDate) ? ` · ${ageText(p.birthDate)}` : ""}</p>
      </div>
      <PatientTabs id={id} />
      {children}
    </div>
  );
}
