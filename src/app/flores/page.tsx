import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProtectedAreaLogin } from "@/components/ProtectedAreaLogin";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { FloresDashboard } from "./flores-dashboard";
import "./flores.css";
import "../plants/plants.css";

export const metadata: Metadata = {
  title: "Flowers · Nube",
  description: "FLORES price history and daily candle count.",
};

export const dynamic = "force-dynamic";

export default async function FloresPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authenticated = isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value);
  if (!authenticated) {
    const { error } = await searchParams;
    return <ProtectedAreaLogin destination="/flores" error={error}/>;
  }
  return <FloresDashboard />;
}
