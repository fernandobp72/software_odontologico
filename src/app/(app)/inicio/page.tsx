import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export default async function InicioPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Esta sección es para el administrador.</p>;
  const [clinic, users, invites, patients, plans, sessions] = await Promise.all([
    db.clinic.findUniqueOrThrow({ where: { id: user.clinicId } }),
    db.user.count({ where: { clinicId: user.clinicId, active: true } }),
    db.invitation.count({ where: { clinicId: user.clinicId, acceptedAt: null, revokedAt: null } }),
    db.patient.count({ where: { clinicId: user.clinicId } }),
    db.treatmentPlan.count({ where: { patient: { clinicId: user.clinicId } } }),
    db.cashSession.count({ where: { clinicId: user.clinicId } }),
  ]);

  const steps = [
    { done: !!(clinic.nit && clinic.address && clinic.phone), title: "Completa los datos del consultorio", hint: "NIT, dirección y teléfono salen en recibos y cuentas de cobro.", href: "/configuracion" },
    { done: users > 1 || invites > 0, title: "Invita a tu equipo", hint: "Odontólogos, auxiliares y recepción, cada uno con su rol.", href: "/equipo" },
    { done: patients > 0, title: "Crea tu primer paciente", hint: "Con su autorización de tratamiento de datos.", href: "/pacientes/nuevo" },
    { done: plans > 0, title: "Crea un plan de tratamiento", hint: "Desde la ficha del paciente, en Diagnósticos y plan.", href: "/pacientes" },
    { done: sessions > 0, title: "Abre la caja", hint: "Para registrar cobros y generar recibos.", href: "/caja" },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Bienvenido, {clinic.name}</h1>
        <p className="muted">Estos pasos te dejan listo para atender. Llevas {done} de {steps.length}.</p>
      </div>
      <div className="h-3 max-w-xl overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length}><div className="h-full bg-teal-700" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ul className="max-w-xl space-y-3">
        {steps.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className={`card flex items-start gap-3 hover:border-teal-700 ${s.done ? "opacity-70" : ""}`}>
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${s.done ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 text-transparent"}`} aria-hidden>✓</span>
              <span><span className="block font-semibold text-slate-900">{s.title}{s.done ? " — listo" : ""}</span><span className="muted">{s.hint}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
