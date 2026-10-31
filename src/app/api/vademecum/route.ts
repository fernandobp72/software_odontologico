import { currentUser } from "@/lib/dal";
import { drugById } from "@/lib/vademecum";
import { verifyPresentation } from "@/lib/invima";

// Estado de una presentación del vademécum frente al CUM del INVIMA. Solo personal clínico.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sesión vencida" }, { status: 401 });
  if (user.role === "RECEPTION") return Response.json({ error: "Sin permiso" }, { status: 403 });
  const u = new URL(req.url);
  const d = drugById(u.searchParams.get("drug") ?? "");
  const p = d?.presentations.find((x) => x.id === u.searchParams.get("pres"));
  if (!d || !p) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json(await verifyPresentation(d, p), { headers: { "Cache-Control": "private, max-age=3600" } });
}
