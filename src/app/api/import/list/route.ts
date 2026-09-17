import { NextRequest, NextResponse } from "next/server";
import { requireSecret } from "@/lib/require-secret";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authError = requireSecret(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("imports")
    .select("id, file_name, period_start, period_end, imported_at, platforms(name)")
    .order("period_start", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imports: data });
}
