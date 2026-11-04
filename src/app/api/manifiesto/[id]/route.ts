import { db } from "@/lib/db";
import { DEFAULT_THEME, hexOk, iconVersion } from "@/lib/app-icon";

// Manifiesto de la app instalada de un consultorio: su nombre, su ícono y su color. El navegador lo lee al instalar.
export async function GET(_: Request, ctx: RouteContext<"/api/manifiesto/[id]">) {
  const { id } = await ctx.params;
  const c = await db.clinic.findFirst({ where: { id, system: false }, select: { id: true, name: true, iconColor: true, logoUpdatedAt: true, appIconUpdatedAt: true } });
  const v = c ? iconVersion(c) : "0";
  const icon = (size: number, extra = "") => `/api/icono/${c?.id ?? "generico"}/${size}?v=${v}${extra}`;
  const short = (c?.name ?? "Odontología").trim();
  const body = {
    // Distinto «id» por consultorio: quien trabaja en dos puede instalar las dos apps en el mismo celular.
    id: c ? `/?consultorio=${c.id}` : "/",
    name: c?.name ?? "Software Odontológico",
    short_name: short.length > 12 ? short.slice(0, 12).replace(/\s+\S*$/, "") || short.slice(0, 12) : short,
    start_url: "/agenda",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6f3",
    theme_color: c && hexOk(c.iconColor) ? c.iconColor : DEFAULT_THEME,
    icons: [
      { src: icon(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon(512, "&m=1"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } });
}
