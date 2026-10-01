import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { PlantsDashboard } from "./plants-dashboard";
import "./plants.css";
import { PlantsRecovery } from "./plants-recovery";
import { PlantLoadError, describePlantFailure, redactPlantLog } from "@/lib/plants-diagnostics";

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
  const maxAttempts = 3;
  console.info("plants_data_load_started", { incidentId, occurredAt: new Date().toISOString() });
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let stage = "create_client";
    try {
      const db = createSupabaseAdminClient();
      stage = "database_queries";
      const runQuery = async <T,>(query: string, run: () => PromiseLike<T>): Promise<T> => {
        try { return await run(); }
        catch (cause) { throw Object.assign(new Error(cause instanceof Error ? cause.message : String(cause)), { query, cause }); }
      };
      const signal = AbortSignal.timeout(7000);
      const [measurements, water, nutrients] = await Promise.all([
        runQuery("gardening_measurements", () => db.from("gardening_measurements").select("import_id,plant_id,measured_at,total_height").order("measured_at").limit(5000).abortSignal(signal)),
        runQuery("gardening_water_events", () => db.from("gardening_water_events").select("import_id,plant_id,measured_at,amount").order("measured_at").limit(5000).abortSignal(signal)),
        runQuery("gardening_nutrient_events", () => db.from("gardening_nutrient_events").select("import_id,plant_id,sampled_at,dose").order("sampled_at").limit(5000).abortSignal(signal)),
      ]);
      const failures = [
        { query: "gardening_measurements", result: measurements },
        { query: "gardening_water_events", result: water },
        { query: "gardening_nutrient_events", result: nutrients },
      ].filter(({ result }) => result.error);
      for (const { query, result } of failures) {
        console.warn("plants_query_failed", { incidentId, attempt, query, status: result.status, code: result.error?.code, message: redactPlantLog(result.error?.message ?? ""), details: redactPlantLog(result.error?.details ?? ""), hint: redactPlantLog(result.error?.hint ?? "") });
      }
      const failed = failures.find(({ result }) => !describePlantFailure({ ...result.error, status: result.status }).retryable) ?? failures[0];
      if (failed) throw Object.assign(new Error(failed.result.error!.message), { code: failed.result.error!.code, status: failed.result.status, query: failed.query });
      stage = "transform_data";
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
    console.info("plants_data_load_succeeded", { incidentId, attempt, elapsedMs: Date.now() - startedAt, measurements: allMeasurements.length, waterEvents: allWaterEvents.length, nutrientEvents: allNutrientEvents.length });
    return {
      measurements: allMeasurements.filter(onOrAfterFirstWater),
      waterEvents: allWaterEvents.filter(onOrAfterFirstWater),
      nutrientEvents: allNutrientEvents.filter(onOrAfterFirstWater),
    };
    } catch (error) {
      const failure = describePlantFailure(error);
      const diagnostic = {
        incidentId, occurredAt: new Date().toISOString(), attempts: attempt, elapsedMs: Date.now() - startedAt,
        category: failure.category, query: error && typeof error === "object" && "query" in error ? String(error.query) : stage,
        status: failure.status, code: failure.code, retryable: failure.retryable, summary: failure.summary,
      };
      const retry = failure.retryable && attempt < maxAttempts;
      console[retry ? "warn" : "error"](retry ? "plants_data_load_retry" : "plants_data_load_failed", { ...diagnostic, message: redactPlantLog(failure.message), cause: redactPlantLog(failure.cause), deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" });
      if (!retry) throw new PlantLoadError(diagnostic);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
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
    if (error instanceof PlantLoadError) return <PlantsRecovery diagnostic={error.diagnostic}/>;
    console.error("plants_page_render_failed", { message: redactPlantLog(error instanceof Error ? error.message : String(error)) });
    throw error;
  }
}
