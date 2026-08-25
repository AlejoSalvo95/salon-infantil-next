import { NextResponse } from "next/server";
import { isGardeningApiAuthorized } from "@/lib/gardening-api-auth";
import { parseGardeningCsv } from "@/lib/gardening-csv";
import { persistGardeningImport } from "@/lib/persist-gardening-import";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    if (!isGardeningApiAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const plantId = String(formData.get("plantId") ?? "").trim();
    if (!(file instanceof File) || !plantId || plantId.length > 100) {
      return NextResponse.json({ error: "Provide a CSV file and a valid plantId." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "The CSV file must be between 1 byte and 10 MB." }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "The file must have a .csv extension." }, { status: 415 });
    }

    const parsed = parseGardeningCsv(await file.text());
    const importId = await persistGardeningImport(file.name, plantId, parsed);

    return NextResponse.json({
      importId, status: "completed", measurements: parsed.measurements.length,
      waterEvents: parsed.waterEvents.length, nutrientEvents: parsed.nutrientEvents.length,
      issues: parsed.issues,
    }, { status: 201 });
  } catch (error) {
    console.error("gardening_import_error", error);
    return NextResponse.json({ error: "We could not import the CSV file." }, { status: 500 });
  }
}
