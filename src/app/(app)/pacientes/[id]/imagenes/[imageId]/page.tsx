import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { IMAGE_KINDS, type ImageKind } from "@/lib/images";
import { voidImage } from "../actions";
import InterpretForm from "./interpret-form";
import Viewer from "./viewer";

export default async function ImagenPage({ params }: PageProps<"/pacientes/[id]/imagenes/[imageId]">) {
  const user = await requireUser();
  const { id, imageId } = await params;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;

  const img = await db.clinicalImage.findFirst({
    where: { id: imageId, patientId: id, patient: { clinicId: user.clinicId } },
    select: { id: true, kind: true, tooth: true, takenAt: true, note: true, fileName: true, mimeType: true, size: true, width: true, height: true, interpretation: true, interpretedById: true, interpretedAt: true, voidedAt: true, voidReason: true, createdAt: true, uploadedBy: { select: { name: true } } },
  });
  if (!img) notFound();
  const interpreter = img.interpretedById ? await db.user.findUnique({ where: { id: img.interpretedById }, select: { name: true } }) : null;
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
  const day = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" });
  const label = IMAGE_KINDS[img.kind as ImageKind] ?? img.kind;
  const src = `/api/imagenes/${img.id}`;

  return (
    <div className="space-y-4">
      <Link href={`/pacientes/${id}/imagenes`} className="btn-secondary w-fit">← Volver a las imágenes</Link>
      {img.voidedAt && <p className="rounded-lg border border-red-700 bg-red-50 p-3 font-semibold text-red-800">Anulada: {img.voidReason}</p>}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2"><Viewer src={src} alt={label} isPdf={img.mimeType === "application/pdf"} /></div>
        <aside className="space-y-4">
          <dl className="card divide-y divide-slate-200 p-0">
            {[
              ["Tipo", label],
              ["Diente", img.tooth ? String(img.tooth) : "—"],
              ["Fecha de toma", day.format(img.takenAt)],
              ["Subida por", `${img.uploadedBy.name}, ${fmt.format(img.createdAt)}`],
              ["Archivo", `${img.fileName} · ${(img.size / 1024).toFixed(0)} KB${img.width ? ` · ${img.width}×${img.height}` : ""}`],
              ["Nota", img.note ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="muted">{k}</dt><dd className="text-right text-sm font-semibold text-slate-900">{v}</dd></div>
            ))}
          </dl>
          <section className="card space-y-3">
            <h2 className="section-title">Interpretación</h2>
            {img.interpretation ? (
              <>
                <p className="whitespace-pre-wrap text-slate-900">{img.interpretation}</p>
                <p className="muted">{interpreter?.name} · {img.interpretedAt ? fmt.format(img.interpretedAt) : ""}</p>
              </>
            ) : img.voidedAt ? <p className="muted">Sin interpretación.</p> : <InterpretForm imageId={img.id} />}
          </section>
          {!img.voidedAt && (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">Anular este archivo</summary>
              <form action={voidImage.bind(null, img.id)} className="mt-3 flex flex-wrap gap-2">
                <input name="reason" required minLength={5} placeholder="Motivo (ej. paciente equivocado)" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
                <button className="btn-danger">Anular</button>
              </form>
              <p className="muted mt-2">El archivo no se borra: queda guardado y deja de mostrarse en la galería.</p>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
