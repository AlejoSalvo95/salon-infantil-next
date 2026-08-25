import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProtectedAreaLogin } from "@/components/ProtectedAreaLogin";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { SeedlingCalculator } from "./seedling-calculator";
import "./seedlings.css";
import "../plants/plants.css";

export const metadata: Metadata = {
  title: "Seedling Estimates · Nube",
  description: "Seedling availability calculators and cycle projections.",
};
export const dynamic = "force-dynamic";

export default async function SeedlingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authenticated = isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value);
  if (!authenticated) {
    const { error } = await searchParams;
    return <ProtectedAreaLogin destination="/seedlings" error={error}/>;
  }
  return <SeedlingCalculator />;
}
