import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { PlantsDashboard } from "./plants-dashboard";
import "./plants.css";

export const metadata: Metadata = {
  title: "Plants · Nube",
  description: "Private plant growth and care tracking.",
};
export const dynamic = "force-dynamic";

export type PlantMeasurement = { plantId: string; date: string; totalHeight: number };
export type PlantEvent = { plantId: string; date: string; value: number };

async function loadPlantData() {
  const incidentId = crypto.randomUUID();
  const startedAt = Date.now();
  const retryable = (message: string) => /jwt issued at future|fetch failed|network|timeout|connection|\b50[234]\b/i.test(message);
  for (let attempt = 0; attempt < 5; attempt++) {
    const db = createSupabaseAdminClient();
    const [measurements, water, nutrients] = await Promise.all([
      db.from("gardening_measurements").select("import_id,plant_id,measured_at,total_height").order("measured_at").limit(5000),
      db.from("gardening_water_events").select("import_id,plant_id,measured_at,amount").order("measured_at").limit(5000),
      db.from("gardening_nutrient_events").select("import_id,plant_id,sampled_at,dose").order("sampled_at").limit(5000),
    ]);
    const failedQuery = [
      { query: "gardening_measurements", error: measurements.error },
      { query: "gardening_water_events", error: water.error },
      { query: "gardening_nutrient_events", error: nutrients.error },
    ].find((result) => result.error);
    const error = failedQuery?.error;
    if (error && retryable(error.message) && attempt < 4) {
      console.warn("plants_data_load_retry", {
        incidentId,
        query: failedQuery?.query,
        attempt: attempt + 1,
        code: error.code,
        message: error.message,
        elapsedMs: Date.now() - startedAt,
      });
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }
    if (error) {
      console.error("plants_data_load_failed", {
        incidentId,
        query: failedQuery?.query,
        attempt: attempt + 1,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        elapsedMs: Date.now() - startedAt,
        supabaseHost: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : "missing",
        keyType: process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_") ? "secret" : process.env.SUPABASE_SERVICE_ROLE_KEY ? "legacy-service-role" : "missing",
      });
      throw new Error(`Plant data query failed [${incidentId}]: ${error.message}`);
    }
    const activeImports = new Set((measurements.data ?? []).map((row) => row.import_id));
    const allMeasurements = (measurements.data ?? []).map((row) => ({ plantId: row.plant_id, date: row.measured_at, totalHeight: row.total_height }));
    const allWaterEvents = (water.data ?? []).filter((row) => activeImports.has(row.import_id)).map((row) => ({ plantId: row.plant_id, date: row.measured_at, value: row.amount }));
    const allNutrientEvents = (nutrients.data ?? []).filter((row) => activeImports.has(row.import_id)).map((row) => ({ plantId: row.plant_id, date: row.sampled_at, value: row.dose }));
    const firstWaterByPlant = new Map<string, string>();
    allWaterEvents.filter((event) => event.value > 0).forEach((event) => {
      const current = firstWaterByPlant.get(event.plantId);
      if (!current || event.date < current) firstWaterByPlant.set(event.plantId, event.date);
    });
    const onOrAfterFirstWater = (item: { plantId: string; date: string }) => {
      const firstWater = firstWaterByPlant.get(item.plantId);
      return !firstWater || item.date >= firstWater;
    };
    return {
      measurements: allMeasurements.filter(onOrAfterFirstWater),
      waterEvents: allWaterEvents.filter(onOrAfterFirstWater),
      nutrientEvents: allNutrientEvents.filter(onOrAfterFirstWater),
    };
  }
  throw new Error("Plant data could not be loaded.");
}

export default async function PlantsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authenticated = isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value);
  if (!authenticated) {
    const { error } = await searchParams;
    return <main className="plants-login"><a className="plants-logo" href="/">☁ nube</a><section><p className="plants-kicker">Private garden</p><h1>Watch them<br/><em>grow.</em></h1><p>Enter the garden key to view plant measurements.</p><form action="/api/plants/login" method="post"><label htmlFor="password">Garden access key</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>{error && <span role="alert">The garden key is incorrect.</span>}<button type="submit">Open plant tracker <span>→</span></button></form></section><aside aria-hidden="true"><span>✿</span></aside></main>;
  }
  try {
    const data = await loadPlantData();
    return <PlantsDashboard {...data} />;
  } catch (error) {
    console.error("plants_page_render_failed", error);
    throw error;
  }
}
