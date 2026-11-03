import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import ReceiptView, { loadReceipt } from "../../recibo/receipt-view";
import PrintButton from "../../recibo/[id]/print-button";
import { receiptCookie } from "./access";
import UnlockForm from "./unlock-form";

export const metadata: Metadata = { title: "Recibo de caja", robots: { index: false, follow: false } };

const MAX_FAILURES = 5;
const MAX_OPENS_PER_DAY = 30;
const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto max-w-md bg-white p-6 text-slate-900 print:p-0">{children}</main>
);

// Recibo compartido por el consultorio: enlace secreto que vence a los 7 días, pide los últimos 4 dígitos del documento,
// se bloquea tras 5 fallos y tiene un tope de aperturas por día para frenar descargas automáticas.
export default async function ComprobantePage({ params }: PageProps<"/comprobante/[token]">) {
  const { token } = await params;
  const h = hashToken(token);
  const link = await db.payment.findFirst({ where: { shareTokenHash: h, shareExpiresAt: { gt: new Date() } }, select: { id: true, shareFailures: true, shareOpens: true, shareOpensDay: true } });
  if (!link) notFound();
  if (link.shareFailures >= MAX_FAILURES) return <Shell><p className="text-center">Este enlace está bloqueado por demasiados intentos. Pide uno nuevo al consultorio.</p></Shell>;

  const want = receiptCookie(token);
  const got = (await cookies()).get(want.name)?.value ?? "";
  const ok = got.length === want.value.length && timingSafeEqual(Buffer.from(got), Buffer.from(want.value));
  if (!ok) return <Shell><UnlockForm token={token} /></Shell>;

  const today = day();
  const opens = link.shareOpensDay === today ? link.shareOpens : 0;
  if (opens >= MAX_OPENS_PER_DAY) return <Shell><p className="text-center">Se superó el número de aperturas de hoy. Intenta de nuevo mañana o pide un enlace nuevo al consultorio.</p></Shell>;
  await db.payment.update({ where: { id: link.id }, data: { shareOpens: opens + 1, shareOpensDay: today } });

  const p = await loadReceipt({ shareTokenHash: h, shareExpiresAt: { gt: new Date() } });
  if (!p) notFound();
  return (
    <Shell>
      <ReceiptView p={p} maskDocument />
      <div className="mt-6 text-center print:hidden"><PrintButton label="Imprimir o guardar PDF" /></div>
    </Shell>
  );
}
