import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { PlantsDashboard } from "./plants-dashboard";
import "./plants.css";

export const metadata: Metadata = {
  title: "Plantas · Nube",
  description: "Seguimiento privado de crecimiento y cuidados de las plantas.",
};
export const dynamic = "force-dynamic";

export type PlantMeasurement = { plantId: string; date: string; totalHeight: number };
export type PlantEvent = { plantId: string; date: string; value: number };

async function loadPlantData() {
  const db = createSupabaseAdminClient();
  const [measurements, water, nutrients] = await Promise.all([
    db.from("gardening_measurements").select("plant_id,measured_at,total_height").order("measured_at").limit(5000),
    db.from("gardening_water_events").select("plant_id,measured_at,amount").order("measured_at").limit(5000),
    db.from("gardening_nutrient_events").select("plant_id,sampled_at,dose").order("sampled_at").limit(5000),
  ]);
  const error = measurements.error ?? water.error ?? nutrients.error;
  if (error) throw new Error(error.message);
  return {
    measurements: (measurements.data ?? []).map((row) => ({ plantId: row.plant_id, date: row.measured_at, totalHeight: row.total_height })),
    waterEvents: (water.data ?? []).map((row) => ({ plantId: row.plant_id, date: row.measured_at, value: row.amount })),
    nutrientEvents: (nutrients.data ?? []).map((row) => ({ plantId: row.plant_id, date: row.sampled_at, value: row.dose })),
  };
}

export default async function PlantsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authenticated = isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value);
  if (!authenticated) {
    const { error } = await searchParams;
    return <main className="plants-login"><a className="plants-logo" href="/">☁ nube</a><section><p className="plants-kicker">Área privada</p><h1>Observá cómo<br/><em>crecen.</em></h1><p>Ingresá la clave de jardinería para consultar las mediciones.</p><form action="/api/plants/login" method="post"><label htmlFor="password">Clave de acceso</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>{error && <span role="alert">La clave no es correcta.</span>}<button type="submit">Entrar al seguimiento <span>→</span></button></form></section><aside aria-hidden="true"><span>✿</span></aside></main>;
  }
  const data = await loadPlantData();
  return <PlantsDashboard {...data} />;
}
