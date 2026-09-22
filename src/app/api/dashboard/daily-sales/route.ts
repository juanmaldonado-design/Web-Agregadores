import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface DayBucket {
  date: string;
  orderCount: number;
  grossSales: number;
  platformFee: number;
  netAmount: number;
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json({ error: "Falta storeId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("order_created_at, gross_sales, platform_fee, platform_fee_tax, net_amount")
    .eq("store_id", storeId)
    .not("order_created_at", "is", null)
    .order("order_created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se agrupa por día en el servidor usando los componentes UTC del
  // timestamp: así se guardó (ver parseSpanishOrderDateTime en rappi-import.ts).
  const buckets = new Map<string, DayBucket>();
  for (const o of data ?? []) {
    if (!o.order_created_at) continue;
    const date = new Date(o.order_created_at).toISOString().slice(0, 10);
    const bucket = buckets.get(date) ?? { date, orderCount: 0, grossSales: 0, platformFee: 0, netAmount: 0 };
    bucket.orderCount += 1;
    bucket.grossSales += Number(o.gross_sales) || 0;
    bucket.platformFee += (Number(o.platform_fee) || 0) + (Number(o.platform_fee_tax) || 0);
    bucket.netAmount += Number(o.net_amount) || 0;
    buckets.set(date, bucket);
  }

  const days = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ days });
}
