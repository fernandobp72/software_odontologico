import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { normalizePhone } from "@/lib/whatsapp";
import PrintButton from "./print-button";
import ShareButtons from "./share-buttons";
import ReceiptView, { loadReceipt } from "../receipt-view";

export default async function ReciboPage({ params }: PageProps<"/recibo/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await loadReceipt({ id, clinicId: user.clinicId });
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-md bg-white p-6 text-slate-900 print:p-0">
      <ReceiptView p={p} />
      <div className="mt-6 space-y-3 text-center print:hidden">
        <PrintButton />
        {!p.voidedAt && <ShareButtons paymentId={p.id} hasPhone={!!normalizePhone(p.patient.phone)} email={p.patient.email} hasLink={!!p.shareTokenHash && !!p.shareExpiresAt && p.shareExpiresAt > new Date()} />}
      </div>
    </main>
  );
}
