import { requireUser } from "@/lib/dal";

export default async function SinSedePage() {
  await requireUser();
  return (
    <div className="card max-w-md space-y-2">
      <h1 className="text-xl font-bold">Sin sede asignada</h1>
      <p className="text-slate-800">Todavía no tienes acceso a ninguna sede. Pide al administrador de tu consultorio que te asigne una desde la sección Equipo.</p>
    </div>
  );
}
