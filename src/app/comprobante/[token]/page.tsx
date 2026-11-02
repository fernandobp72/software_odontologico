import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hashToken } from "@/lib/tokens";
import ReceiptView, { loadReceipt } from "../../recibo/receipt-view";
import PrintButton from "../../recibo/[id]/print-button";

export const metadata: Metadata = { title: "Recibo de caja", robots: { index: false, follow: false } };

// Recibo compartido por el consultorio: se abre con un enlace secreto que vence a los 30 días.
export default async function ComprobantePage({ params }: PageProps<"/comprobante/[token]">) {
  const { token } = await params;
  const p = await loadReceipt({ shareTokenHash: hashToken(token), shareExpiresAt: { gt: new Date() } });
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-md bg-white p-6 text-slate-900 print:p-0">
      <ReceiptView p={p} />
      <div className="mt-6 text-center print:hidden"><PrintButton label="Imprimir o guardar PDF" /></div>
    </main>
  );
}
