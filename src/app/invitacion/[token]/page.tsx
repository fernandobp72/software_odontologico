import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import AcceptForm from "./form";

export const metadata = { title: "Invitación", robots: { index: false } };
const ROLE: Record<string, string> = { ADMIN: "administrador", DENTIST: "odontólogo", RECEPTION: "recepción" };

export default async function InvitacionPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { clinic: { select: { name: true } } } });
  const valid = inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        {valid ? (
          <>
            <p className="text-sm font-semibold text-teal-800">{inv.clinic.name}</p>
            <h1 className="text-xl font-bold">Te invitaron como {ROLE[inv.role]}</h1>
            <p className="muted">Tu correo de acceso será {inv.email}.</p>
            <AcceptForm token={token} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Invitación no disponible</h1>
            <p className="text-slate-700">El enlace venció, fue revocado o ya se usó. Pide al administrador una invitación nueva.</p>
          </>
        )}
      </div>
    </main>
  );
}
