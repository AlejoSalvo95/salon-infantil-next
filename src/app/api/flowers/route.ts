import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";

type FlowerRecord = {
  date: string;
  referencePrice: number;
  source: "api" | "csv";
  purchaseAmount?: number;
  flowersReceived?: number;
};

export async function GET(request: NextRequest) {
  if (!isPlantsSessionValid(request.cookies.get(PLANTS_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get("range") || "max";
  const interval = "1d";
  const baseUrl = process.env.FLOWERS_API_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return NextResponse.json(
      { error: "FLOWERS_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  console.log({ url });

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Flower market data could not be retrieved" },
        { status: response.status },
      );
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps: unknown[] = result?.timestamp ?? [];
    const prices: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
    const apiHistory = timestamps.flatMap((timestamp, index) => {
      const price = prices[index];
      if (typeof timestamp !== "number" || typeof price !== "number") return [];
      return [{
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        referencePrice: price,
        source: "api" as const,
      }];
    });

    const csvPath = path.join(process.cwd(), "src", "app", "api", "flowers", "flowers.csv");
    const csv = await readFile(csvPath, "utf8");
    const [header, ...rows] = csv.trim().split(/\r?\n/);
    const columns = header.split(",");
    const columnIndex = (nombre: string) => columns.indexOf(nombre);
    const csvHistory = rows.flatMap((fila) => {
      const values = fila.split(",");
      const date = values[columnIndex("Date")];
      const price = Number(values[columnIndex("Flower Market Price")]);
      if (!date || !Number.isFinite(price)) return [];
      return [{
        date,
        referencePrice: price,
        source: "csv" as const,
        purchaseAmount: Number(values[columnIndex("Purchase Amount")]) || 0,
        flowersReceived: Number(values[columnIndex("Flowers Received")]) || 0,
      }];
    });

    const byDate = new Map<string, FlowerRecord>(csvHistory.map((item) => [item.date, item]));
    apiHistory.forEach((item) => byDate.set(item.date, item));
    const firstCsvDate = csvHistory.map((item) => item.date).sort()[0];
    const combined = [...byDate.values()]
      .filter((item) => !firstCsvDate || item.date >= firstCsvDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    const daysByRange: Record<string, number> = { "7d": 7, "1mo": 31, "2mo": 62, "6mo": 186, "1y": 366 };
    const days = daysByRange[range];
    const lastDate = combined.at(-1)?.date;
    const cutoff = days && lastDate ? new Date(`${lastDate}T00:00:00Z`).getTime() - days * 86400000 : 0;
    const history = cutoff ? combined.filter((item) => new Date(`${item.date}T00:00:00Z`).getTime() >= cutoff) : combined;

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json(
      { error: "Flower market data could not be loaded" },
      { status: 500 },
    );
  }
}
