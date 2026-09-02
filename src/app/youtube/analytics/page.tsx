import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProtectedAreaLogin } from "@/components/ProtectedAreaLogin";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { YouTubeDashboard } from "../youtube-dashboard";
import "../../plants/plants.css";
import "../youtube.css";

export const metadata: Metadata = {
  title: "YouTube analytics · Nube",
  description: "Métricas de Shorts y videos de un canal de YouTube.",
};
export const dynamic = "force-dynamic";

export default async function YouTubeAnalyticsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (!isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value)) {
    const { error } = await searchParams;
    return <ProtectedAreaLogin destination="/youtube/analytics" error={error} />;
  }
  return <YouTubeDashboard />;
}
