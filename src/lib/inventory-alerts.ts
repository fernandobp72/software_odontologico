import { cache } from "react";
import { db } from "./db";
import { evaluate } from "./inventory";

// Cuántos productos de la sede están en rojo y en amarillo (para la marca del menú y el aviso de Inicio).
export const supplyAlerts = cache(async (clinicId: string, branchId: string) => {
  const [items, moved] = await Promise.all([
    db.supplyItem.findMany({ where: { clinicId, active: true }, include: { lots: { where: { branchId, quantity: { gt: 0 } } } } }),
    db.supplyMovement.groupBy({ by: ["itemId"], where: { clinicId, branchId }, _count: { _all: true } }),
  ]);
  const stocked = new Set(moved.map((m) => m.itemId));
  let red = 0;
  let yellow = 0;
  for (const i of items) {
    const l = evaluate(i, i.lots, stocked.has(i.id)).level;
    if (l === "RED") red++;
    else if (l === "YELLOW") yellow++;
  }
  return { red, yellow };
});
