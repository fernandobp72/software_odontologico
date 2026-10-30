import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import ClinicForm from "./form";

export default async function ConfiguracionPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo administración puede ver esta sección.</p>;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { name: true, nit: true, address: true, phone: true } });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Consultorio</h1>
      <ClinicForm clinic={clinic} />
    </div>
  );
}
