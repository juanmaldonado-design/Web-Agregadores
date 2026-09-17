import { NextRequest, NextResponse } from "next/server";

/**
 * Verifica el header "x-import-secret" contra IMPORT_UPLOAD_SECRET.
 * Devuelve una respuesta de error si no coincide, o null si está OK.
 */
export function requireSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.IMPORT_UPLOAD_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "El servidor no tiene configurada IMPORT_UPLOAD_SECRET." },
      { status: 500 }
    );
  }
  const provided = request.headers.get("x-import-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }
  return null;
}
