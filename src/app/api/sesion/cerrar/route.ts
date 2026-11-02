import { NextResponse } from "next/server";

// Sesión vencida, inválida o de un usuario desactivado: se borra la cookie y se vuelve al ingreso.
// Sin esto el proxy (que solo ve que la cookie existe) y requireUser se mandaban el uno al otro sin fin.
export function GET() {
  const res = new NextResponse(null, { status: 307, headers: { Location: "/login", "Cache-Control": "no-store" } });
  res.cookies.delete("session");
  return res;
}
