import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { packages, type PackageName } from "@/lib/data";

const phonePattern = /^[+\d][\d\s()-]{6,19}$/;
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const childName = String(body.childName ?? "").trim().slice(0, 80);
    const parentName = String(body.parentName ?? "").trim().slice(0, 120);
    const phone = String(body.phone ?? "").trim().slice(0, 24);
    const age = Number(body.age);
    const kids = Number(body.kids);
    const packageName = String(body.packageName) as PackageName;
    const eventDate = String(body.eventDate ?? "");
    const timeSlot = String(body.timeSlot ?? "");
    const extraNames: string[] = Array.isArray(body.extras) ? body.extras.map(String).slice(0, 10) : [];
    const selectedPackage = packages.find((item) => item.name === packageName);

    if (!childName || !parentName || !phonePattern.test(phone) || !selectedPackage ||
        !Number.isInteger(age) || age < 1 || age > 14 || !Number.isInteger(kids) || kids < 5 || kids > 40 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return NextResponse.json({ error: "Revisá los datos de la solicitud." }, { status: 400 });
    }
    if (eventDate <= new Date().toISOString().slice(0, 10))
      return NextResponse.json({ error: "Elegí una fecha futura." }, { status: 400 });

    const { data: slot } = await createSupabaseServerClient().from("availability_slots")
      .select("id").eq("event_date", eventDate).eq("time_slot", timeSlot).eq("is_available", true).maybeSingle();
    if (!slot) return NextResponse.json({ error: "Ese horario ya no está disponible." }, { status: 409 });

    const extraPrices: Record<string, number> = {
      "Decoración temática": 4500, "Fotografía": 3200, "Candy bar": 2800
    };
    const total = selectedPackage.price + extraNames.reduce((sum, name) => sum + (extraPrices[name] ?? 0), 0);
    const { error } = await createSupabaseServerClient().from("bookings").insert({
      child_name: childName, child_age: age, parent_name: parentName, phone,
      event_date: eventDate, time_slot: timeSlot, package_name: packageName,
      kids_count: kids, extras: extraNames, estimated_total: total, status: "pending"
    });
    if (error?.code === "23505") return NextResponse.json({ error: "Ese horario acaba de ser solicitado." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("booking_error", error);
    return NextResponse.json({ error: "No pudimos guardar la consulta." }, { status: 500 });
  }
}
