import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";

// Soporte de un gasto: lo ve administración, o quien lo registró.
export async function GET(_: Request, ctx: RouteContext<"/api/gastos/[id]/soporte">) {
  const user = await currentUser();
  if (!user || user.role === "DENTIST") return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  const e = await db.expense.findFirst({
    where: { id, clinicId: user.clinicId, ...(user.role === "ADMIN" ? {} : { createdById: user.id }) },
    select: { data: true, mimeType: true, fileName: true },
  });
  if (!e?.data || !e.mimeType) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(e.data), {
    headers: {
      "Content-Type": e.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(e.fileName ?? "soporte")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...(e.mimeType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'" }),
    },
  });
}
