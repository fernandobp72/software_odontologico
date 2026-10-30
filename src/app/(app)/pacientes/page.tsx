import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export default async function PacientesPage({ searchParams }: PageProps<"/pacientes">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";

  const patients = await db.patient.findMany({
    where: {
      clinicId: user.clinicId,
      ...(term && {
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { documentNumber: { contains: term } },
        ],
      }),
    },
    orderBy: { lastName: "asc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Pacientes</h1>
        <Link href="/pacientes/nuevo" className="btn-primary">Nuevo paciente</Link>
      </div>
      <form>
        <input name="q" defaultValue={term} placeholder="Buscar por nombre o documento" aria-label="Buscar paciente" className="field md:max-w-md" />
      </form>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {patients.map((p) => (
          <li key={p.id}>
            <Link href={`/pacientes/${p.id}`} className="card block hover:border-teal-700">
              <p className="text-lg font-semibold">{p.firstName} {p.lastName}</p>
              <p className="muted">{p.documentType} {p.documentNumber}{p.phone ? ` · ${p.phone}` : ""}</p>
            </Link>
          </li>
        ))}
        {patients.length === 0 && <li className="card text-center text-slate-700 md:col-span-2 xl:col-span-3">Sin resultados</li>}
      </ul>
    </div>
  );
}
