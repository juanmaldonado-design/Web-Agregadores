import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role key, solo para uso server-side (scripts de
 * importación, route handlers). Nunca exponer SUPABASE_SERVICE_ROLE_KEY al cliente.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno"
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
