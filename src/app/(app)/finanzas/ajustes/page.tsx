import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { financeSettings } from "@/lib/finanzas-data";
import { SettingsForm } from "../empleados/forms";

// Cifras que cambian cada año o que define el contador.
export default async function AjustesFinanzasPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const s = await financeSettings(user.clinicId);
  return (
    <div className="space-y-6">
      <h1 className="page-title">Ajustes de finanzas</h1>
      <SettingsForm s={s} />
    </div>
  );
}
