import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseGardeningCsv } from "../src/lib/gardening-csv";
import { persistGardeningImport } from "../src/lib/persist-gardening-import";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function loadLocalEnvironment() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  let contents: string;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  await loadLocalEnvironment();
  const [, , fileArgument, plantArgument] = process.argv;
  const plantId = String(plantArgument ?? "").trim();

  if (!fileArgument || !plantId || plantId.length > 100) {
    throw new Error("Usage: pnpm import:gardening -- data/imports/file.csv PLANT_ID");
  }

  const filePath = path.resolve(process.cwd(), fileArgument);
  if (!filePath.toLowerCase().endsWith(".csv")) throw new Error("The file must have a .csv extension.");

  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > MAX_FILE_SIZE) {
    throw new Error("The CSV file must be between 1 byte and 10 MB.");
  }

  const parsed = parseGardeningCsv(await readFile(filePath, "utf8"));
  const importId = await persistGardeningImport(path.basename(filePath), plantId, parsed);

  console.log(JSON.stringify({
    importId,
    status: "completed",
    measurements: parsed.measurements.length,
    waterEvents: parsed.waterEvents.length,
    nutrientEvents: parsed.nutrientEvents.length,
    issues: parsed.issues,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
