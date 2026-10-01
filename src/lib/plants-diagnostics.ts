export type PlantLoadDiagnostic = {
  incidentId: string; occurredAt: string; attempts: number; elapsedMs: number;
  category: "timeout" | "connection" | "authentication" | "configuration" | "service" | "unexpected";
  query: string; status: number | null; code: string | null; retryable: boolean; summary: string;
};
export class PlantLoadError extends Error {
  constructor(public diagnostic: PlantLoadDiagnostic) { super(diagnostic.summary); this.name = "PlantLoadError"; }
}
export function describePlantFailure(error: unknown) {
  const entry = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = entry.cause && typeof entry.cause === "object" ? entry.cause as Record<string, unknown> : {};
  const message = String(entry.message ?? error ?? "Unknown error");
  const code = String(entry.code ?? cause.code ?? "");
  const text = `${entry.name ?? ""} ${message} ${code} ${cause.message ?? ""}`;
  const status = typeof entry.status === "number" ? entry.status : null;
  const timeout = /timeout|timed out|aborterror|aborted/i.test(text);
  const clock = /jwt issued at future|not yet valid/i.test(text);
  const connection = /fetch failed|network|connection|ECONN|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(text);
  const temporary = status === 429 || (status !== null && status >= 500 && status <= 599) || /\b50[234]\b/.test(text);
  const configuration = /not configured|invalid supabaseurl|invalid url|supabaseurl is required|supabasekey is required/i.test(text);
  const authentication = clock || status === 401 || status === 403 || /jwt|api key|permission denied|42501|PGRST30[123]/i.test(text);
  const category: PlantLoadDiagnostic["category"] = configuration ? "configuration" : timeout ? "timeout" : authentication ? "authentication" : connection ? "connection" : temporary ? "service" : "unexpected";
  const summaries = {
    configuration: "The server's data-service configuration is missing or invalid.",
    timeout: "The data service did not respond within the time limit.",
    authentication: clock ? "The data service temporarily rejected the credential timestamp." : "The data service rejected the server credentials or database permissions.",
    connection: "The server could not establish a connection to the data service.",
    service: "The data service is temporarily unavailable or rate-limited.",
    unexpected: "An unexpected error occurred while loading plant data.",
  };
  return { category, retryable: !configuration && (timeout || clock || connection || temporary), summary: summaries[category], status, code: /^[A-Z0-9_]{1,40}$/i.test(code) ? code : null, message, cause: String(cause.message ?? "") };
}

// Server logs contain diagnostics, never credentials or complete request URLs.
export function redactPlantLog(value: string) {
  let result = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/i.test(name) && secret && secret.length > 5) result = result.split(secret).join("[redacted]");
  }
  return result.replace(/https?:\/\/[^\s"'<>]+/g, "[url]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]").slice(0, 2000);
}