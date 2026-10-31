import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";
import { LOGO_MAX_INPUT, processLogo } from "@/lib/logo";

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

async function admin(req: Request) {
  if (!sameOrigin(req)) return { error: Response.json({ error: "Origen no permitido" }, { status: 403 }) };
  const user = await currentUser();
  if (!user) return { error: Response.json({ error: "Sesión vencida" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: Response.json({ error: "Solo el administrador puede cambiar el logo" }, { status: 403 }) };
  return { user };
}

export async function POST(req: Request) {
  const a = await admin(req);
  if (a.error) return a.error;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > LOGO_MAX_INPUT) return Response.json({ error: "El archivo supera 15 MB" }, { status: 413 });
  let out;
  try {
    out = await processLogo(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    const msg = e instanceof Error && e.message.startsWith("El SVG") ? e.message : "No se pudo leer la imagen. Prueba con un JPG, PNG o WebP.";
    return Response.json({ error: msg }, { status: 415 });
  }
  await db.clinic.update({ where: { id: a.user!.clinicId }, data: { logo: new Uint8Array(out.data), logoUpdatedAt: new Date() } });
  await db.auditLog.create({ data: { userId: a.user!.id, action: "LOGO_SET", entity: "Clinic", entityId: a.user!.clinicId } });
  return Response.json({ ok: true, original: file.size, optimized: out.bytes, width: out.width, height: out.height });
}

export async function DELETE(req: Request) {
  const a = await admin(req);
  if (a.error) return a.error;
  await db.clinic.update({ where: { id: a.user!.clinicId }, data: { logo: null, logoUpdatedAt: null } });
  await db.auditLog.create({ data: { userId: a.user!.id, action: "LOGO_REMOVE", entity: "Clinic", entityId: a.user!.clinicId } });
  return Response.json({ ok: true });
}
