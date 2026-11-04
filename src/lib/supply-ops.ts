import { db } from "./db";
import { pickFefo, todayBogota } from "./inventory";

type Ctx = { clinicId: string; branchId: string; userId: string };

// Descuenta de los lotes que vencen primero (nunca de los vencidos). partial=true toma lo que haya y dice cuánto faltó;
// partial=false no toca nada si no alcanza.
export async function takeFefo(ctx: Ctx, itemId: string, qty: number, opts: { note?: string | null; refId?: string | null; partial?: boolean } = {}) {
  const lots = await db.supplyLot.findMany({ where: { itemId, branchId: ctx.branchId, quantity: { gt: 0 } } });
  const today = todayBogota();
  const have = lots.filter((l) => !l.expiresAt || l.expiresAt >= today).reduce((s, l) => s + l.quantity, 0);
  const want = opts.partial ? Math.min(qty, have) : qty;
  if (want <= 0) return { taken: 0, short: qty, have, ok: opts.partial ? true : false as boolean };
  const takes = pickFefo(lots, want, today);
  if (!takes) return { taken: 0, short: qty, have, ok: false };
  try {
    await db.$transaction(async (tx) => {
      for (const { lot, take } of takes) {
        // Descuento condicionado: si otra persona gastó el lote mientras tanto, no queda en negativo.
        const r = await tx.supplyLot.updateMany({ where: { id: lot.id, quantity: { gte: take } }, data: { quantity: { decrement: take } } });
        if (r.count !== 1) throw new Error("race");
        await tx.supplyMovement.create({ data: { clinicId: ctx.clinicId, branchId: ctx.branchId, itemId, lotId: lot.id, kind: "OUT", delta: -take, note: opts.note ?? null, userId: ctx.userId, refId: opts.refId ?? null } });
      }
    });
  } catch {
    return { taken: 0, short: qty, have, ok: false, raced: true };
  }
  return { taken: want, short: qty - want, have, ok: true };
}

export async function receiveLot(ctx: Ctx, item: { id: string }, qty: number, expiresAt: Date | null, lotCode: string | null) {
  await db.$transaction(async (tx) => {
    const lot = await tx.supplyLot.create({ data: { clinicId: ctx.clinicId, branchId: ctx.branchId, itemId: item.id, lotCode, quantity: qty, initialQty: qty, expiresAt, createdById: ctx.userId } });
    await tx.supplyMovement.create({ data: { clinicId: ctx.clinicId, branchId: ctx.branchId, itemId: item.id, lotId: lot.id, kind: "IN", delta: qty, note: lotCode ? `Lote ${lotCode}` : null, userId: ctx.userId } });
  });
}

// Consumo automático por kits: cada procedimiento hecho (por nombre del catálogo) descuenta sus insumos. Nunca falla la
// historia clínica por el inventario: lo que no alcance simplemente no se descuenta (el semáforo ya queda en rojo).
export async function consumeForProcedures(ctx: Ctx, refId: string, label: string, done: { name: string; quantity: number }[]) {
  if (!done.length) return { used: 0 };
  if (await db.supplyMovement.findFirst({ where: { refId }, select: { id: true } })) return { used: 0 };
  const procs = await db.clinicProcedure.findMany({ where: { clinicId: ctx.clinicId, name: { in: [...new Set(done.map((d) => d.name))] } }, select: { procId: true, name: true } });
  const byName = new Map(procs.map((p) => [p.name, p.procId]));
  const lines = await db.supplyKitLine.findMany({ where: { clinicId: ctx.clinicId, procId: { in: procs.map((p) => p.procId) }, item: { active: true } } });
  const need = new Map<string, number>();
  for (const d of done) {
    const procId = byName.get(d.name);
    if (!procId) continue;
    for (const l of lines.filter((x) => x.procId === procId)) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.quantity * d.quantity);
  }
  let used = 0;
  for (const [itemId, qty] of need) {
    const r = await takeFefo(ctx, itemId, qty, { note: label, refId, partial: true });
    used += r.taken;
  }
  return { used };
}
