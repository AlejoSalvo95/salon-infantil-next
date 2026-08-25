import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProtectedAreaLogin } from "@/components/ProtectedAreaLogin";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { FlowersDashboard } from "./flowers-dashboard";
import "./flowers.css";
import "../plants/plants.css";

export const metadata: Metadata = {
  title: "Flowers · Nube",
  description: "FLORES price history and daily candle count.",
};

export const dynamic = "force-dynamic";

export default async function FlowersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authenticated = isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value);
  if (!authenticated) {
    const { error } = await searchParams;
    return <ProtectedAreaLogin destination="/flowers" error={error}/>;
  }
  return <FlowersDashboard />;
}
