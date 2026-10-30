import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";
import { IMAGE_KINDS, MAX_BYTES, sniff } from "@/lib/images";
import { VALID_TEETH } from "@/lib/catalogs";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const meta = z.object({
  kind: z.enum(Object.keys(IMAGE_KINDS) as [keyof typeof IMAGE_KINDS, ...(keyof typeof IMAGE_KINDS)[]]),
  tooth: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().refine((t) => VALID_TEETH.has(t)).nullable()),
  takenAt: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "Fecha inválida"),
  note: z.string().trim().max(300).optional(),
  width: z.coerce.number().int().positive().max(20000).optional(),
  height: z.coerce.number().int().positive().max(20000).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/pacientes/[id]/imagenes">) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sesión vencida" }, { status: 401 });
  if (user.role === "RECEPTION") return Response.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await ctx.params;
  const patient = await db.patient.findFirst({ where: { id, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return Response.json({ error: "Paciente no encontrado" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El archivo supera 10 MB" }, { status: 413 });

  const parsed = meta.safeParse(Object.fromEntries(form));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(data);
  if (!mime) return Response.json({ error: "Formato no permitido (usa JPG, PNG, WebP o PDF)" }, { status: 415 });

  let thumb: Uint8Array<ArrayBuffer> | undefined;
  const t = form.get("thumb");
  if (t instanceof File && t.size > 0 && t.size < 200_000) {
    const tb = new Uint8Array(await t.arrayBuffer());
    if (sniff(tb) === "image/jpeg") thumb = tb;
  }

  const d = parsed.data;
  const row = await db.clinicalImage.create({
    data: {
      patientId: patient.id,
      uploadedById: user.id,
      kind: d.kind,
      tooth: d.tooth,
      takenAt: new Date(d.takenAt),
      note: d.note || null,
      fileName: file.name.slice(0, 120),
      mimeType: mime,
      size: file.size,
      width: d.width ?? null,
      height: d.height ?? null,
      data,
      thumb,
    },
    select: { id: true },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "UPLOAD", entity: "ClinicalImage", entityId: row.id } });
  return Response.json({ id: row.id });
}
