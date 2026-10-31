import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { birthInputValue } from "@/lib/patient-fields";
import EditPatientForm from "./form";

export default async function EditarPacientePage({ params }: PageProps<"/pacientes/[id]/editar">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!p) notFound();
  const s = (v: string | null) => v ?? "";
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="section-title">Editar datos del paciente</h2>
      <EditPatientForm
        patientId={p.id}
        values={{
          documentType: p.documentType, documentNumber: p.documentNumber, firstName: p.firstName, middleName: s(p.middleName), lastName: p.lastName, secondLastName: s(p.secondLastName),
          birthDate: birthInputValue(p.birthDate), sex: s(p.sex), phone: s(p.phone), email: s(p.email), address: s(p.address), city: s(p.city), eps: s(p.eps), regime: s(p.regime),
          occupation: s(p.occupation), companionName: s(p.companionName), companionPhone: s(p.companionPhone), companionKin: s(p.companionKin), allergies: s(p.allergies),
        }}
      />
    </div>
  );
}
