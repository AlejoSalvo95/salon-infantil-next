import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await createSupabaseServerClient()
      .from("availability_slots").select("event_date,time_slot")
      .gte("event_date", today).eq("is_available", true)
      .order("event_date").limit(12);
    if (error) throw error;
    return NextResponse.json({ slots: data });
  } catch (error) {
    console.error("availability_error", error);
    return NextResponse.json({ error: "We could not retrieve the available dates." }, { status: 500 });
  }
}
