import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";

// Entrega el archivo solo a profesionales del mismo consultorio y deja constancia del acceso.
export async function GET(req: Request, ctx: RouteContext<"/api/imagenes/[id]">) {
  const user = await currentUser();
  if (!user || user.role === "RECEPTION") return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  const thumbOnly = new URL(req.url).searchParams.has("thumb");

  const img = await db.clinicalImage.findFirst({
    where: { id, patient: { clinicId: user.clinicId } },
    select: { data: !thumbOnly, thumb: thumbOnly, mimeType: true, fileName: true },
  });
  const bytes = img ? (thumbOnly ? img.thumb : img.data) : null;
  if (!img || !bytes) return new Response("No encontrado", { status: 404 });

  if (!thumbOnly) await db.auditLog.create({ data: { userId: user.id, action: "VIEW", entity: "ClinicalImage", entityId: id } });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": thumbOnly ? "image/jpeg" : img.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(img.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Los PDF no admiten sandbox en el visor del navegador; las imágenes sí.
      ...(img.mimeType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'" }),
    },
  });
}
