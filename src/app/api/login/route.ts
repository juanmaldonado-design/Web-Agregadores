import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const secret = process.env.IMPORT_UPLOAD_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "El servidor no tiene configurada IMPORT_UPLOAD_SECRET." }, { status: 500 });
  }

  const formData = await request.formData();
  const password = formData.get("password");
  if (password !== secret) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const token = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
