import "server-only";
import { db } from "./db";

// Efectivo que debería haber en la caja: base + cobros en efectivo − gastos pagados con el efectivo de la caja.
export async function expectedCash(sessionId: string) {
  const [s, cash, out] = await Promise.all([
    db.cashSession.findUniqueOrThrow({ where: { id: sessionId }, select: { openingAmount: true } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { sessionId, method: "CASH", voidedAt: null } }),
    db.expensePayment.aggregate({ _sum: { amount: true }, where: { sessionId, voidedAt: null } }),
  ]);
  return s.openingAmount + (cash._sum.amount ?? 0) - (out._sum.amount ?? 0);
}
