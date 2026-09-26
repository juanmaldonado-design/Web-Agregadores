import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const secret = process.env.IMPORT_UPLOAD_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = secret ? await verifySessionToken(token, secret) : false;

  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/dashboard")) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
