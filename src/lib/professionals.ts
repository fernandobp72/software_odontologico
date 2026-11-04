import { db } from "./db";

export type Professional = { id: string; name: string; role: string };

// Quienes pueden atender en una sede: los odontólogos asignados a ella y los administradores con registro profesional
// (o, si no hay otro, los administradores, que en un consultorio pequeño son quienes atienden).
export async function branchProfessionals(clinicId: string, branchId: string): Promise<Professional[]> {
  const [dentists, admins] = await Promise.all([
    db.user.findMany({ where: { clinicId, active: true, role: "DENTIST", userBranches: { some: { branchId } } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { clinicId, active: true, role: "ADMIN" }, select: { id: true, name: true, role: true, licenseNumber: true }, orderBy: { name: "asc" } }),
  ]);
  const licensed = admins.filter((a) => a.licenseNumber).map(({ id, name, role }) => ({ id, name, role }));
  const pool = [...dentists, ...licensed];
  return pool.length ? pool : admins.map(({ id, name, role }) => ({ id, name, role }));
}
