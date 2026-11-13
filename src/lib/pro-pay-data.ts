import "server-only";
import { db } from "./db";
import { allocate, earnedFor, type Agreement } from "./pro-pay";

export type ProLine = {
  itemId: string;
  patientId: string;
  patientName: string;
  description: string;
  doneAt: Date;
  price: number;
  collected: number;
  lab: number;
  earned: number;
  paid: number; // ya liquidado en liquidaciones anteriores
  due: number; // lo que se le debe hoy por este procedimiento (negativo si el paciente recibió una devolución)
};

// Cuenta de un profesional armada sola: lo que hizo, lo que el paciente ya pagó, el laboratorio y lo ya liquidado.
export async function proAccount(clinicId: string, userId: string, a: Agreement) {
  const mine = await db.treatmentItem.findMany({
    where: { status: "DONE", doneById: userId, doneAt: { not: null }, plan: { patient: { clinicId } } },
    select: { id: true, name: true, tooth: true, unitPrice: true, quantity: true, doneAt: true, plan: { select: { patientId: true, patient: { select: { firstName: true, lastName: true } } } } },
  });
  if (!mine.length) return { lines: [] as ProLine[], due: 0, pending: 0, earned: 0 };

  const patientIds = [...new Set(mine.map((i) => i.plan.patientId))];
  const itemIds = mine.map((i) => i.id);
  const [all, paidBy, labs, settled] = await Promise.all([
    db.treatmentItem.findMany({ where: { status: "DONE", doneAt: { not: null }, plan: { patientId: { in: patientIds } } }, select: { id: true, unitPrice: true, quantity: true, doneAt: true, plan: { select: { patientId: true } } } }),
    db.payment.groupBy({ by: ["patientId"], where: { clinicId, patientId: { in: patientIds }, voidedAt: null }, _sum: { amount: true } }),
    // El laboratorio que se descuenta: las órdenes normales y las repeticiones que asume el profesional.
    db.labOrder.findMany({ where: { clinicId, itemId: { in: itemIds }, voidedAt: null, OR: [{ redoOfId: null }, { redoPayer: "PRO" }] }, select: { itemId: true, cost: true } }),
    db.proSettlementLine.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds }, settlement: { userId, voidedAt: null } }, _sum: { amount: true } }),
  ]);

  const paid = new Map(paidBy.map((p) => [p.patientId, p._sum.amount ?? 0]));
  const collected = new Map<string, number>();
  for (const pid of patientIds) {
    const list = all.filter((i) => i.plan.patientId === pid).map((i) => ({ id: i.id, doneAt: i.doneAt as Date, price: i.unitPrice * i.quantity }));
    for (const [id, v] of allocate(list, paid.get(pid) ?? 0)) collected.set(id, v);
  }
  const labOf = new Map<string, number>();
  for (const l of labs) if (l.itemId) labOf.set(l.itemId, (labOf.get(l.itemId) ?? 0) + l.cost);
  const paidOut = new Map(settled.map((s) => [s.itemId as string, s._sum.amount ?? 0]));

  const lines: ProLine[] = mine
    .map((i) => {
      const price = i.unitPrice * i.quantity;
      const c = collected.get(i.id) ?? 0;
      const lab = a.deductLab ? labOf.get(i.id) ?? 0 : 0;
      const earned = earnedFor(price, c, lab, a);
      const p = paidOut.get(i.id) ?? 0;
      return {
        itemId: i.id,
        patientId: i.plan.patientId,
        patientName: `${i.plan.patient.firstName} ${i.plan.patient.lastName}`,
        description: `${i.name}${i.tooth ? ` · diente ${i.tooth}` : ""}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`,
        doneAt: i.doneAt as Date,
        price,
        collected: c,
        lab,
        earned,
        paid: p,
        due: earned - p,
      };
    })
    .sort((x, y) => x.doneAt.getTime() - y.doneAt.getTime());

  const due = lines.reduce((s, l) => s + l.due, 0);
  // Lo que todavía no ha pagado el paciente: el profesional lo ganará cuando entre.
  const pending = lines.reduce((s, l) => s + (earnedFor(l.price, l.price, l.lab, a) - l.earned), 0);
  return { lines, due, pending, earned: lines.reduce((s, l) => s + l.earned, 0) };
}

// Profesionales que pueden tener acuerdo: odontólogos y administradores que atienden (con registro profesional).
export async function professionals(clinicId: string) {
  return db.user.findMany({
    where: { clinicId, active: true, OR: [{ role: "DENTIST" }, { role: "ADMIN", licenseNumber: { not: null } }, { proAgreement: { isNot: null } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, role: true, proAgreement: true },
  });
}
