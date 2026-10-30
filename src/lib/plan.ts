import "server-only";
import { db } from "./db";

// Recalcula el estado del plan a partir de sus ítems.
export async function syncPlan(planId: string) {
  const plan = await db.treatmentPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan || plan.status === "CANCELLED" || plan.status === "DRAFT" || plan.status === "PRESENTED") return;
  const active = plan.items.filter((i) => i.status !== "CANCELLED");
  const done = active.filter((i) => i.status === "DONE").length;
  let status = plan.status;
  if (active.length > 0 && done === active.length) status = "COMPLETED";
  else if (done > 0 || active.some((i) => i.status === "IN_PROGRESS")) status = "IN_PROGRESS";
  else status = "ACCEPTED";
  if (status !== plan.status) await db.treatmentPlan.update({ where: { id: planId }, data: { status } });
}
