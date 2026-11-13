import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { todayStr } from "@/lib/finanzas";
import { financeSettings } from "@/lib/finanzas-data";
import { EmployeeForm } from "../forms";

export default async function NuevoEmpleadoPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const s = await financeSettings(user.clinicId);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/finanzas/empleados" className="text-sm font-semibold text-teal-800 underline">← Empleados</Link>
        <h1 className="page-title mt-2">Nuevo empleado</h1>
      </div>
      <EmployeeForm today={todayStr()} minWage={s.minWage} />
    </div>
  );
}
