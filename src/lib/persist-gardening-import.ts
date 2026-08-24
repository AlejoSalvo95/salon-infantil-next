import type { GardeningCsvResult } from "./gardening-csv";

const PARSER_VERSION = "1.0.0";

function getSupabaseAdminConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Admin no está configurado. Definí SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local.",
    );
  }
  return { url, key };
}

export async function persistGardeningImport(
  filename: string,
  plantId: string,
  parsed: GardeningCsvResult,
): Promise<string> {
  const { url, key } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/rpc/persist_gardening_import`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_filename: filename.slice(0, 255),
      p_plant_id: plantId,
      p_parser_version: PARSER_VERSION,
      p_total_rows: parsed.totalRows,
      p_measurements: parsed.measurements.map((item) => ({
        measured_at: item.measuredAt,
        total_height: item.totalHeight,
        source_row: item.sourceRow,
      })),
      p_water_events: parsed.waterEvents.map((item) => ({
        measured_at: item.measuredAt,
        amount: item.amount,
        source_row: item.sourceRow,
      })),
      p_nutrient_events: parsed.nutrientEvents.map((item) => ({
        sampled_at: item.sampledAt,
        dose: item.dose,
        source_row: item.sourceRow,
      })),
      p_issues: parsed.issues.map((item) => ({
        row_number: item.rowNumber,
        raw_value: item.rawValue,
        error_message: item.message,
      })),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase rechazó la importación (${response.status}): ${details}`);
  }

  const importId: unknown = await response.json();
  if (typeof importId !== "string") throw new Error("Supabase no devolvió el ID de la importación.");
  return importId;
}
