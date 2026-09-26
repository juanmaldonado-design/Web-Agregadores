/**
 * Sesión simple de una sola clave compartida (no hay usuarios individuales).
 * El token es "expiración.firma", firmado con HMAC-SHA256 usando
 * IMPORT_UPLOAD_SECRET como clave — así el valor de la cookie no revela la
 * clave y no se puede falsificar sin conocerla.
 */
const SESSION_DAYS = 30;

// Sin Buffer a propósito: el middleware puede correr en el runtime "edge",
// que no lo tiene. btoa/atob y crypto.subtle sí están disponibles ahí.
function bytesToBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64Url(sig);
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const signature = await hmac(secret, String(expires));
  return `${expires}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [expiresStr, signature] = token.split(".");
  if (!expiresStr || !signature) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmac(secret, expiresStr);
  return expected === signature;
}

export const SESSION_COOKIE = "wa_session";
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
