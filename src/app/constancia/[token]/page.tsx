import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deviceLabel } from "@/lib/device";
import { hashToken } from "@/lib/tokens";
import PrintButton from "../../recibo/[id]/print-button";
import { MAX_FAILURES, constanciaUnlocked } from "./access";
import UnlockForm from "./unlock-form";

export const metadata: Metadata = { title: "Constancia de firma", robots: { index: false, follow: false } };

const Shell = ({ children }: { children: React.ReactNode }) => <main className="mx-auto max-w-xl bg-white p-5 pb-10 text-slate-900 print:p-0">{children}</main>;
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
const METHOD: Record<string, string> = { QR: "desde su propio celular, con código QR en el consultorio", ENLACE: "desde su propio celular, con un enlace" };

// Constancia que recibe el paciente de lo que firmó: el documento completo, su firma y cómo se firmó. Se arma al momento desde el registro.
export default async function ConstanciaPage({ params }: PageProps<"/constancia/[token]">) {
  const { token } = await params;
  const c = await db.consent.findFirst({
    where: { receiptTokenHash: hashToken(token), receiptExpiresAt: { gt: new Date() } },
    include: { dentist: { select: { name: true, licenseNumber: true } }, patient: { select: { clinic: { select: { name: true, nit: true, phone: true } } } } },
  });
  if (!c) notFound();
  const clinic = c.patient.clinic;
  if (c.receiptFailures >= MAX_FAILURES) return <Shell><p className="text-center">Este enlace está bloqueado por demasiados intentos. Pide uno nuevo al consultorio.</p></Shell>;
  if (!(await constanciaUnlocked(token))) return <Shell><h1 className="mb-4 text-center text-lg font-bold">{clinic.name}</h1><UnlockForm token={token} /></Shell>;

  return (
    <Shell>
      <header className="border-b border-slate-400 pb-3 text-center">
        <h1 className="text-xl font-bold">{clinic.name}</h1>
        {clinic.nit && <p className="text-sm">NIT {clinic.nit}</p>}
        <p className="mt-2 text-lg font-semibold">Constancia de firma</p>
      </header>
      <h2 className="mt-4 text-lg font-bold">{c.title}</h2>
      <div className="my-4 whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-50 p-4 text-[15px] leading-relaxed print:border-0 print:bg-white">{c.body}</div>
      <section className="space-y-2 text-sm">
        <p><strong>Firmó:</strong> {c.signerName} ({c.signerRelation}){c.signerDocument ? ` · ${c.signerDocument}` : ""}</p>
        <p><strong>Fecha y hora:</strong> {fmt.format(c.signedAt)}</p>
        <p><strong>Cómo se firmó:</strong> {c.signMethod ? `${METHOD[c.signMethod] ?? "desde su celular"} (${deviceLabel(c.signAgent)})` : "en el aparato del consultorio, con el profesional presente"}</p>
        <p><strong>Profesional:</strong> {c.dentist.name}{c.dentist.licenseNumber ? ` · Registro ${c.dentist.licenseNumber}` : ""}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.signature} alt={`Firma de ${c.signerName}`} className="h-28 rounded border border-slate-300 bg-white" />
        {c.seal && <p className="muted break-all">Sello de integridad: {c.seal.slice(0, 16).toUpperCase()} · se puede comprobar en <a className="underline" href={`/verificar/${c.seal}`}>esta página</a>.</p>}
      </section>
      <p className="mt-4 rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950 print:hidden">Si no reconoces esta firma, comunícate de inmediato con {clinic.name}{clinic.phone ? ` al ${clinic.phone}` : ""}.</p>
      <div className="mt-4 text-center print:hidden"><PrintButton label="Imprimir o guardar PDF" /></div>
    </Shell>
  );
}
