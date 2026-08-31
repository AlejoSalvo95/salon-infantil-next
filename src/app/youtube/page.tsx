import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { YouTubeDashboard } from "./youtube-dashboard";
import "./youtube.css";

export const metadata: Metadata = {
  title: "YouTube metrics · Nube",
  description: "Métricas de Shorts y videos de un canal de YouTube.",
};
export const dynamic = "force-dynamic";

export default async function YouTubePage() {
  const cookieStore = await cookies();
  if (!isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value)) redirect("/plants");
  return <YouTubeDashboard />;
}
