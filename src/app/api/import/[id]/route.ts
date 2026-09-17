import { NextRequest, NextResponse } from "next/server";
import { requireSecret } from "@/lib/require-secret";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/import/[id]">) {
  const authError = requireSecret(request);
  if (authError) return authError;

  const { id } = await ctx.params;

  // Borra el import; orders y weekly_summary se borran en cascada (FK on delete cascade).
  const { error } = await supabaseAdmin.from("imports").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
