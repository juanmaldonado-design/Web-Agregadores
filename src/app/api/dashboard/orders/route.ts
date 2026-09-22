import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId");
  const date = request.nextUrl.searchParams.get("date"); // YYYY-MM-DD
  if (!storeId || !date) {
    return NextResponse.json({ error: "Faltan storeId y/o date" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date debe tener formato AAAA-MM-DD" }, { status: 400 });
  }

  const rangeStart = `${date}T00:00:00.000Z`;
  const rangeEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, external_order_id, order_created_at, transaction_type, order_status, gross_sales, platform_fee, platform_fee_tax, manual_adjustment, net_amount, raw"
    )
    .eq("store_id", storeId)
    .gte("order_created_at", rangeStart)
    .lte("order_created_at", rangeEnd)
    .order("order_created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}
