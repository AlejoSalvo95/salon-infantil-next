export type Measurement = { measuredAt: string; totalHeight: number; sourceRow: number };
export type WaterEvent = { measuredAt: string; amount: number; sourceRow: number };
export type NutrientEvent = { sampledAt: string; dose: number; sourceRow: number };
export type ImportIssue = { rowNumber: number; rawValue: string; message: string };
export type GardeningCsvResult = {
  measurements: Measurement[];
  waterEvents: WaterEvent[];
  nutrientEvents: NutrientEvent[];
  issues: ImportIssue[];
  totalRows: number;
};

type Section = "measurements" | "water" | "nutrients" | null;

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }

  if (quoted) throw new Error("El CSV contiene una comilla sin cerrar.");
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function parseDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function finiteNumber(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGardeningCsv(input: string): GardeningCsvResult {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  const measurements = new Map<string, Measurement>();
  const waterEvents: WaterEvent[] = [];
  const nutrientEvents: NutrientEvent[] = [];
  const issues: ImportIssue[] = [];
  let section: Section = null;
  let lastMeasurementDate: string | null = null;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const first = row[0] ?? "";
    const rawValue = row.join(",");
    if (first === "MeasureDate") { section = "measurements"; return; }
    if (first === "WaterAdded") { section = "water"; return; }
    if (first === "NutrientDose") { section = "nutrients"; return; }

    if (section === "measurements") {
      const measuredAt = parseDate(first);
      const totalHeight = finiteNumber(row[1] ?? "");
      if (!measuredAt || totalHeight === null) {
        issues.push({ rowNumber, rawValue, message: "Medición con fecha o valores inválidos." });
        return;
      }
      measurements.set(measuredAt, {
        measuredAt, totalHeight, sourceRow: rowNumber,
      });
      lastMeasurementDate = measuredAt;
      return;
    }

    if (section === "water") {
      const amount = finiteNumber(first);
      if (amount === null || !lastMeasurementDate) {
        issues.push({ rowNumber, rawValue, message: "Evento de agua sin cantidad o fecha asociada válida." });
      } else if (amount > 0) waterEvents.push({ measuredAt: lastMeasurementDate, amount, sourceRow: rowNumber });
      section = null;
      return;
    }

    if (section === "nutrients") {
      const dose = finiteNumber(first);
      const sampledAt = parseDate(row[1] ?? "");
      if (dose === null || !sampledAt) {
        issues.push({ rowNumber, rawValue, message: "Evento de nutrientes con dosis o fecha inválida." });
      } else nutrientEvents.push({ sampledAt, dose, sourceRow: rowNumber });
      return;
    }

    issues.push({ rowNumber, rawValue, message: "Fila fuera de una sección reconocida." });
  });

  return {
    measurements: [...measurements.values()].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    waterEvents, nutrientEvents, issues, totalRows: rows.length,
  };
}
