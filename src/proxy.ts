import { NextResponse, type NextRequest } from "next/server";

// Comprobación optimista: la validación real ocurre en requireUser().
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/agenda", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|confirmar|formulario|registro|invitacion|restablecer|terminos|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.*).*)"],
};
