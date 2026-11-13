import { docText } from "@/lib/patient-fields";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

const PAGE = 50;

export default async function PacientesPage({ searchParams }: PageProps<"/pacientes">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";

  // Cada palabra debe aparecer en el nombre, el apellido, el documento o el celular («ana 300» encuentra a Ana con celular 300…).
  const words = term.split(/\s+/).filter(Boolean).slice(0, 4);
  const where = {
    clinicId: user.clinicId,
    AND: words.map((w) => {
      const digits = w.replace(/\D/g, "");
      return {
        OR: [
          { firstName: { contains: w, mode: "insensitive" as const } },
          { lastName: { contains: w, mode: "insensitive" as const } },
          { documentNumber: { contains: digits.length >= 3 ? digits : w } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      };
    }),
  };
  const [patients, total] = await Promise.all([
    db.patient.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: PAGE }),
    db.patient.count({ where }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Pacientes</h1>
        <span className="flex flex-wrap gap-2">
          {user.role === "ADMIN" && <a href="/api/exportar?tipo=pacientes" className="btn-secondary">Descargar en Excel</a>}
          <Link href="/pacientes/nuevo" className="btn-primary">Nuevo paciente</Link>
        </span>
      </div>
      <form>
        <input name="q" defaultValue={term} placeholder="Buscar por nombre, documento o celular" aria-label="Buscar paciente" className="field md:max-w-md" />
      </form>
      {total > patients.length && <p className="muted">Mostrando {patients.length} de {total} pacientes{term ? " que coinciden" : ""}. Escribe parte del nombre, el documento o el celular para encontrar al que buscas.</p>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {patients.map((p) => (
          <li key={p.id}>
            <Link href={`/pacientes/${p.id}`} className="card block hover:border-teal-700">
              <p className="text-lg font-semibold">{p.firstName} {p.lastName}</p>
              <p className="muted">{docText(p.documentType, p.documentNumber)}{p.phone ? ` · ${p.phone}` : ""}</p>
            </Link>
          </li>
        ))}
        {patients.length === 0 && <li className="card text-center text-slate-700 md:col-span-2 xl:col-span-3">Sin resultados</li>}
      </ul>
    </div>
  );
}
