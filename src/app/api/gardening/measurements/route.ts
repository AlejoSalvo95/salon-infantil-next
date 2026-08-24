import { NextResponse } from "next/server";
import { isGardeningApiAuthorized } from "@/lib/gardening-api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    if (!isGardeningApiAuthorized(request)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = String(searchParams.get("plantId") ?? "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!plantId || plantId.length > 100 || (from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
      return NextResponse.json({ error: "Parámetros de consulta inválidos." }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: "La fecha 'from' no puede ser posterior a 'to'." }, { status: 400 });
    }

    let query = createSupabaseAdminClient()
      .from("gardening_measurements")
      .select("measured_at,total_height")
      .eq("plant_id", plantId)
      .order("measured_at", { ascending: true })
      .limit(5000);
    if (from) query = query.gte("measured_at", from);
    if (to) query = query.lte("measured_at", to);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json((data ?? []).map((item) => ({
      date: item.measured_at, totalHeight: item.total_height,
    })));
  } catch (error) {
    console.error("gardening_measurements_error", error);
    return NextResponse.json({ error: "No pudimos obtener las mediciones." }, { status: 500 });
  }
}
