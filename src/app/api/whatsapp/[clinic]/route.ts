import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { appSecretOf, handleInbound, validSignature } from "@/lib/whatsapp-inbound";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Verificación del webhook que hace Meta al registrarlo (clave propia de cada consultorio).
export async function GET(req: Request, ctx: RouteContext<"/api/whatsapp/[clinic]">) {
  const { clinic: id } = await ctx.params;
  const u = new URL(req.url);
  const c = await db.clinic.findUnique({ where: { id }, select: { whatsappVerifyToken: true } });
  const given = u.searchParams.get("hub.verify_token") ?? "";
  if (c?.whatsappVerifyToken && u.searchParams.get("hub.mode") === "subscribe" && same(given, c.whatsappVerifyToken)) return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  return new Response("No autorizado", { status: 403 });
}

// Respuestas de los pacientes. Se valida la firma de Meta con el secreto de la app del consultorio.
export async function POST(req: Request, ctx: RouteContext<"/api/whatsapp/[clinic]">) {
  const { clinic: id } = await ctx.params;
  const raw = await req.text();
  const c = await db.clinic.findUnique({ where: { id }, select: { whatsappAppSecret: true, whatsappButtons: true } });
  const secret = appSecretOf(c?.whatsappAppSecret ?? null);
  if (!c || !c.whatsappButtons || !secret || !validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("No autorizado", { status: 401 });
  try {
    await handleInbound(id, JSON.parse(raw));
  } catch (e) {
    console.error("Webhook de WhatsApp falló", e);
  }
  return new Response("ok", { status: 200 });
}
