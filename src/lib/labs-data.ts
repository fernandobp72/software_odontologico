import "server-only";
import { db } from "./db";
import { OUTSIDE } from "./labs";

// Trabajos que no han llegado y el paciente ya tiene cita en los próximos días: avisar antes de que llegue a la silla.
export async function labAlerts(clinicId: string, opts: { days?: number; dentistId?: string; patientId?: string } = {}) {
  const now = new Date();
  const orders = await db.labOrder.findMany({
    where: { clinicId, voidedAt: null, status: { in: OUTSIDE }, ...(opts.dentistId ? { dentistId: opts.dentistId } : {}), ...(opts.patientId ? { patientId: opts.patientId } : {}) },
    select: { id: true, number: true, workType: true, tooth: true, promisedAt: true, patientId: true, payee: { select: { name: true } } },
  });
  if (!orders.length) return [];
  const appts = await db.appointment.findMany({
    where: { clinicId, patientId: { in: [...new Set(orders.map((o) => o.patientId))] }, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gte: now, lt: new Date(now.getTime() + (opts.days ?? 7) * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, patientId: true, patient: { select: { firstName: true, lastName: true } } },
  });
  const first = new Map<string, (typeof appts)[number]>();
  for (const a of appts) if (!first.has(a.patientId)) first.set(a.patientId, a);
  return orders
    .filter((o) => first.has(o.patientId))
    .map((o) => ({ ...o, appointment: first.get(o.patientId)! }))
    .sort((a, b) => a.appointment.startsAt.getTime() - b.appointment.startsAt.getTime());
}
