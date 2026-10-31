import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import IntakeForm from "./form";

export const metadata = { title: "Formulario previo", robots: { index: false } };

export default async function FormularioPage({ params }: PageProps<"/formulario/[token]">) {
  const { token } = await params;
  const f = token.length >= 16
    ? await db.intakeForm.findUnique({ where: { tokenHash: hashToken(token) }, include: { patient: { select: { firstName: true, clinic: { select: { id: true, name: true, logoUpdatedAt: true } } } } } })
    : null;
  const valid = f && !f.revokedAt && f.expiresAt > new Date();

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-slate-100 p-4">
      {!valid ? (
        <div className="card space-y-2 p-6 text-center">
          <h1 className="text-xl font-bold">Enlace no disponible</h1>
          <p className="text-slate-700">Este enlace no existe o venció. Pide uno nuevo en el lugar donde te atienden.</p>
        </div>
      ) : f.submittedAt ? (
        <div className="card space-y-2 p-6 text-center">
          <h1 className="text-xl font-bold">Formulario enviado</h1>
          <p className="ok-text">Ya recibimos tu información. ¡Gracias!</p>
        </div>
      ) : (
        <IntakeForm token={token} clinic={f.patient.clinic.name} clinicId={f.patient.clinic.id} logoVersion={f.patient.clinic.logoUpdatedAt?.getTime() ?? null} patientName={f.patient.firstName} />
      )}
    </main>
  );
}
