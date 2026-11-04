import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { MAX_FAILURES } from "./access";
import { STAFF_BLOCK, staffSession, unlocked } from "./access";
import SignForm from "./sign-form";
import UnlockForm from "./unlock-form";

export const metadata: Metadata = { title: "Firmar documento", robots: { index: false, follow: false } };

const Shell = ({ children }: { children: React.ReactNode }) => <main className="mx-auto max-w-xl bg-white p-5 pb-10 text-slate-900">{children}</main>;
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

// Firma del consentimiento por parte del paciente, desde su celular (QR en el consultorio o enlace a distancia).
export default async function FirmarPage({ params }: PageProps<"/firmar/[token]">) {
  const { token } = await params;
  const r = await db.consentRequest.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!r) notFound();
  const clinic = await db.clinic.findFirst({ where: { patients: { some: { id: r.patientId } } }, select: { name: true } });

  if (r.consentId) return <Shell><h1 className="text-xl font-bold">Listo, tu firma quedó registrada</h1><p className="mt-2">Gracias. Ya puedes cerrar esta página. El consultorio conserva el documento firmado.</p></Shell>;
  if (r.cancelledAt) return <Shell><p className="text-center">El consultorio canceló esta solicitud. Pide una nueva si la necesitas.</p></Shell>;
  if (r.expiresAt <= new Date()) return <Shell><p className="text-center">Este enlace venció. Pide uno nuevo al consultorio.</p></Shell>;
  if (r.failures >= MAX_FAILURES) return <Shell><p className="text-center">Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio.</p></Shell>;
  if (await staffSession()) return <Shell><h1 className="text-lg font-bold">Firma bloqueada</h1><p className="mt-2">{STAFF_BLOCK}</p></Shell>;
  if (!(await unlocked(token))) return <Shell><h1 className="mb-4 text-center text-lg font-bold">{clinic?.name}</h1><UnlockForm token={token} /></Shell>;

  return (
    <Shell>
      <p className="text-sm font-semibold text-slate-700">{clinic?.name}</p>
      <h1 className="mt-1 text-xl font-bold">{r.title}</h1>
      <p className="muted mt-1">Para {r.signerName} ({r.signerRelation}) · disponible hasta {fmt.format(r.expiresAt)}</p>
      <div className="my-5 whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-50 p-4 text-[15px] leading-relaxed">{r.body}</div>
      <SignForm token={token} signerName={r.signerName} />
    </Shell>
  );
}
