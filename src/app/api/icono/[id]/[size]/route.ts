import { db } from "@/lib/db";
import { ICON_SIZES, renderIcon } from "@/lib/app-icon";

// Ícono de la app instalada de un consultorio (imagen de marca, sin sesión: el navegador lo pide al instalar).
export async function GET(req: Request, ctx: RouteContext<"/api/icono/[id]/[size]">) {
  const { id, size } = await ctx.params;
  const n = Number(size);
  if (!(ICON_SIZES as readonly number[]).includes(n)) return new Response(null, { status: 404 });
  const maskable = new URL(req.url).searchParams.get("m") === "1";
  const c = await db.clinic.findFirst({ where: { id, system: false }, select: { logo: true, iconColor: true } });
  const png = await renderIcon({ logo: c?.logo ?? null, iconColor: c?.iconColor ?? null }, n, maskable);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
}
