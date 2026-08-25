import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";

type RegistroFlores = {
  fecha: string;
  valorReferencia: number;
  fuente: "api" | "csv";
  compra?: number;
  floresRecibidas?: number;
};

export async function GET(request: NextRequest) {
  if (!isPlantsSessionValid(request.cookies.get(PLANTS_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodo = request.nextUrl.searchParams.get("periodo") || "max";
  const frecuencia = "1d";
  const baseUrl = process.env.FLORES_API_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return NextResponse.json(
      { error: "FLORES_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set("range", periodo);
  url.searchParams.set("interval", frecuencia);
  console.log({ url });

  try {
    const respuesta = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!respuesta.ok) {
      return NextResponse.json(
        { error: "Flower market data could not be retrieved" },
        { status: respuesta.status },
      );
    }

    const datos = await respuesta.json();
    const resultado = datos?.chart?.result?.[0];
    const timestamps: unknown[] = resultado?.timestamp ?? [];
    const precios: unknown[] = resultado?.indicators?.quote?.[0]?.close ?? [];
    const historialApi = timestamps.flatMap((timestamp, index) => {
      const precio = precios[index];
      if (typeof timestamp !== "number" || typeof precio !== "number") return [];
      return [{
        fecha: new Date(timestamp * 1000).toISOString().slice(0, 10),
        valorReferencia: precio,
        fuente: "api" as const,
      }];
    });

    const csvPath = path.join(process.cwd(), "src", "app", "api", "flores", "flores.csv");
    const csv = await readFile(csvPath, "utf8");
    const [encabezado, ...filas] = csv.trim().split(/\r?\n/);
    const columnas = encabezado.split(",");
    const indice = (nombre: string) => columnas.indexOf(nombre);
    const historialCsv = filas.flatMap((fila) => {
      const valores = fila.split(",");
      const fecha = valores[indice("Date")];
      const precio = Number(valores[indice("Flower Market Price")]);
      if (!fecha || !Number.isFinite(precio)) return [];
      return [{
        fecha,
        valorReferencia: precio,
        fuente: "csv" as const,
        compra: Number(valores[indice("Purchase Amount")]) || 0,
        floresRecibidas: Number(valores[indice("Flowers Received")]) || 0,
      }];
    });

    const porDate = new Map<string, RegistroFlores>(historialCsv.map((item) => [item.fecha, item]));
    historialApi.forEach((item) => porDate.set(item.fecha, item));
    const primeraDateCsv = historialCsv.map((item) => item.fecha).sort()[0];
    const combinado = [...porDate.values()]
      .filter((item) => !primeraDateCsv || item.fecha >= primeraDateCsv)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const diasPorRango: Record<string, number> = { "7d": 7, "1mo": 31, "2mo": 62, "6mo": 186, "1y": 366 };
    const dias = diasPorRango[periodo];
    const ultimaDate = combinado.at(-1)?.fecha;
    const limite = dias && ultimaDate ? new Date(`${ultimaDate}T00:00:00Z`).getTime() - dias * 86400000 : 0;
    const historial = limite ? combinado.filter((item) => new Date(`${item.fecha}T00:00:00Z`).getTime() >= limite) : combinado;

    return NextResponse.json({ historial });
  } catch {
    return NextResponse.json(
      { error: "Flower market data could not be loaded" },
      { status: 500 },
    );
  }
}
