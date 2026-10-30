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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Link href="/pacientes/nuevo" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">Nuevo</Link>
      </div>
      <form>
        <input name="q" defaultValue={term} placeholder="Buscar por nombre o documento" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3" />
      </form>
      <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
        {patients.map((p) => (
          <li key={p.id}>
            <Link href={`/pacientes/${p.id}`} className="block px-4 py-3">
              <p className="font-medium">{p.firstName} {p.lastName}</p>
              <p className="text-sm text-slate-500">{p.documentType} {p.documentNumber}{p.phone ? ` · ${p.phone}` : ""}</p>
            </Link>
          </li>
        ))}
        {patients.length === 0 && <li className="px-4 py-6 text-center text-slate-500">Sin resultados</li>}
      </ul>
    </div>
  );
}
