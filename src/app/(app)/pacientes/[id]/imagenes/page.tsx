import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { IMAGE_KINDS, type ImageKind } from "@/lib/images";
import Uploader from "./uploader";

export default async function ImagenesPage({ params, searchParams }: PageProps<"/pacientes/[id]/imagenes">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;
  const { tipo, diente } = await searchParams;
  const kind = typeof tipo === "string" && tipo in IMAGE_KINDS ? (tipo as ImageKind) : undefined;
  const tooth = typeof diente === "string" && /^\d{2}$/.test(diente) ? Number(diente) : undefined;

  const images = await db.clinicalImage.findMany({
    where: { patientId: id, patient: { clinicId: user.clinicId }, voidedAt: null, ...(kind && { kind }), ...(tooth && { tooth }) },
    orderBy: { takenAt: "desc" },
    select: { id: true, kind: true, tooth: true, takenAt: true, mimeType: true, note: true, interpretation: true, thumb: false },
    take: 100,
  });
  const hasThumb = new Set((await db.clinicalImage.findMany({ where: { id: { in: images.map((i) => i.id) }, thumb: { not: null } }, select: { id: true } })).map((i) => i.id));
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`;

  return (
    <div className="space-y-6">
      <Uploader patientId={id} />
      <section className="space-y-3">
        <h2 className="section-title">Imágenes y documentos</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/pacientes/${id}/imagenes`} className={chip(!kind && !tooth)}>Todas</Link>
          {(Object.keys(IMAGE_KINDS) as ImageKind[]).map((k) => (
            <Link key={k} href={`/pacientes/${id}/imagenes?tipo=${k}`} className={chip(kind === k)}>{IMAGE_KINDS[k]}</Link>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {images.map((i) => (
            <li key={i.id}>
              <Link href={`/pacientes/${id}/imagenes/${i.id}`} className="card block overflow-hidden p-0 hover:border-teal-700">
                <div className="flex aspect-square items-center justify-center bg-slate-900">
                  {hasThumb.has(i.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/imagenes/${i.id}?thumb=1`} alt={IMAGE_KINDS[i.kind as ImageKind] ?? i.kind} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white">{i.mimeType === "application/pdf" ? "PDF" : "IMG"}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-900">{IMAGE_KINDS[i.kind as ImageKind] ?? i.kind}{i.tooth ? ` · ${i.tooth}` : ""}</p>
                  <p className="muted">{fmt.format(i.takenAt)}</p>
                  <p className={`text-xs font-semibold ${i.interpretation ? "text-green-800" : "text-amber-800"}`}>{i.interpretation ? "Interpretada" : "Sin interpretar"}</p>
                </div>
              </Link>
            </li>
          ))}
          {images.length === 0 && <li className="card col-span-full text-center text-slate-700">Sin imágenes</li>}
        </ul>
      </section>
    </div>
  );
}
