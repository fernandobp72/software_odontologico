import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import ResetForm from "./form";

export const metadata = { title: "Restablecer contraseña", robots: { index: false } };

export default async function RestablecerPage({ params }: PageProps<"/restablecer/[token]">) {
  const { token } = await params;
  const r = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { name: true, active: true } } } });
  const valid = r && !r.usedAt && r.expiresAt > new Date() && r.user.active;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        {valid ? (
          <>
            <h1 className="text-xl font-bold">Hola {r.user.name}</h1>
            <p className="muted">Define tu contraseña nueva.</p>
            <ResetForm token={token} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Enlace no disponible</h1>
            <p className="text-slate-700">El enlace venció o ya se usó. Pide al administrador uno nuevo.</p>
          </>
        )}
      </div>
    </main>
  );
}
