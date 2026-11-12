"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { PRE_DOC, patientOption, type PatientOption } from "@/lib/patient-fields";


// Búsqueda de pacientes para los selectores (agenda, caja): por nombre, documento o celular, sin tope de pacientes en la base.
export async function searchPatients(q: string, opts: { withPre?: boolean } = {}): Promise<PatientOption[]> {
  const user = await requireUser();
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return [];
  const rows = await db.patient.findMany({
    where: {
      clinicId: user.clinicId,
      ...(opts.withPre ? {} : { documentType: { not: PRE_DOC } }),
      AND: words.map((w) => {
        const digits = w.replace(/\D/g, "");
        return {
          OR: [
            { firstName: { contains: w, mode: "insensitive" as const } },
            { lastName: { contains: w, mode: "insensitive" as const } },
            ...(digits.length >= 3 ? [{ documentNumber: { contains: digits } }, { phone: { contains: digits } }] : [{ documentNumber: { contains: w } }]),
          ],
        };
      }),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20,
    select: { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true, phone: true },
  });
  return rows.map(patientOption);
}
