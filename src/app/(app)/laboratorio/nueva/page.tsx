import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { todayStr } from "@/lib/finanzas";
import { WORK_TYPES } from "@/lib/labs";
import { patientOption } from "@/lib/patient-fields";
import { LabOrderForm, type OrderPrefill } from "../forms";

// Nueva orden. Desde el procedimiento (?item=) el software ya conoce paciente, diente, material y profesional.
export default async function NuevaOrdenPage({ searchParams }: PageProps<"/laboratorio/nueva">) {
  const user = await requireUser();
  if (user.role === "RECEPTION") redirect("/laboratorio");
  const sp = await searchParams;
  const itemId = typeof sp.item === "string" ? sp.item : undefined;
  const patientId = typeof sp.paciente === "string" ? sp.paciente : undefined;
  const redoId = typeof sp.repite === "string" ? sp.repite : undefined;
  const pSelect = { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true, phone: true } as const;

  const prefill: OrderPrefill = { patient: null };
  if (redoId) {
    const o = await db.labOrder.findFirst({ where: { id: redoId, clinicId: user.clinicId }, include: { payee: { select: { name: true } } } });
    if (o) {
      const p = await db.patient.findFirst({ where: { id: o.patientId, clinicId: user.clinicId }, select: pSelect });
      Object.assign(prefill, { patient: p ? patientOption(p) : null, itemId: o.itemId ?? undefined, itemLabel: `${o.workType}${o.tooth ? ` · diente ${o.tooth}` : ""}`, tooth: o.tooth, material: o.material, workType: o.workType, redoOf: { id: o.id, number: o.number, labName: o.payee.name, cost: o.cost } });
    }
  } else if (itemId) {
    const i = await db.treatmentItem.findFirst({ where: { id: itemId, plan: { patient: { clinicId: user.clinicId } } }, select: { id: true, name: true, tooth: true, material: true, plan: { select: { patient: { select: pSelect } } } } });
    if (i) {
      const guess = WORK_TYPES.find((w) => i.name.toLowerCase().includes(w.toLowerCase())) ?? i.name.slice(0, 80);
      Object.assign(prefill, { patient: patientOption(i.plan.patient), itemId: i.id, itemLabel: `${i.name}${i.tooth ? ` · diente ${i.tooth}` : ""}`, tooth: i.tooth, material: i.material, workType: guess });
    }
  } else if (patientId) {
    const p = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: pSelect });
    if (p) prefill.patient = patientOption(p);
  }
  const labs = await db.payee.findMany({ where: { clinicId: user.clinicId, active: true, OR: [{ defaultCategory: "LABORATORIO" }, { labOrders: { some: {} } }] }, orderBy: { name: "asc" }, select: { name: true } });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/laboratorio" className="text-sm font-semibold text-teal-800 underline">← Laboratorio</Link>
        <h1 className="page-title mt-2">{prefill.redoOf ? "Repetir trabajo" : "Enviar a laboratorio"}</h1>
      </div>
      <LabOrderForm today={todayStr()} labs={labs.map((l) => l.name)} prefill={prefill} />
    </div>
  );
}
