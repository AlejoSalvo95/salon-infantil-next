import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { getYouTubeChannelMetrics } from "@/lib/youtube-metrics";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value)) {
    return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar a la zona privada." }, { status: 401 });
  }
  try {
    const body = await request.json() as { channel?: unknown };
    if (typeof body.channel !== "string" || body.channel.length > 300) {
      return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
    }
    return NextResponse.json(await getYouTubeChannelMetrics(body.channel));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo analizar el canal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
