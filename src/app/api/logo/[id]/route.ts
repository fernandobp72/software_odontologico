import { db } from "@/lib/db";

// El logo es imagen de marca (aparece en recibos y en las pantallas que ve el paciente), por eso se sirve sin sesión.
export async function GET(req: Request, ctx: RouteContext<"/api/logo/[id]">) {
  const { id } = await ctx.params;
  const c = await db.clinic.findFirst({ where: { id, system: false }, select: { logo: true, logoUpdatedAt: true } });
  if (!c?.logo || !c.logoUpdatedAt) return new Response(null, { status: 404 });
  const etag = `"${c.logoUpdatedAt.getTime()}"`;
  const headers = { ETag: etag, "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(c.logo), { headers });
}
