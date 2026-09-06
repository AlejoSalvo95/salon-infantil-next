import type { YouTubeChannelMetrics, YouTubeVideoMetric } from "./youtube-metrics";

type Estimate = { label: string; reason: string; tone: "likely" | "unlikely" | "possible" };
const number = new Intl.NumberFormat("es-UY");
const result = (label: string, reason: string, tone: Estimate["tone"]): Estimate => ({ label, reason, tone });

// Heuristic signals, not YouTube eligibility thresholds or calibrated probabilities.
// Lifetime views cannot establish watch hours, past subscriber counts or YPP approval.
export function estimateMonetization(data: YouTubeChannelMetrics) {
  const items = [...data.shorts, ...data.videos];
  const subscribers = data.hiddenSubscriberCount ? null : data.subscriberCount;
  const sum = (videos: YouTubeVideoMetric[]) => videos.reduce((total, video) => total + Math.max(0, video.viewCount ?? 0), 0);
  const views = sum(items);
  const longViews = sum(data.videos);
  const shortViews = sum(data.shorts);
  const now = Date.parse(data.fetchedAt);
  const age = (video: YouTubeVideoMetric) => {
    if (!video.uploadDate || !/^\d{8}$/.test(video.uploadDate)) return null;
    const date = Date.parse(`${video.uploadDate.slice(0, 4)}-${video.uploadDate.slice(4, 6)}-${video.uploadDate.slice(6)}T00:00:00Z`);
    return Number.isFinite(date) && date <= now ? (now - date) / 86400000 : null;
  };
  const ages = items.map(age).filter((days): days is number => days !== null);
  const latestDays = ages.length ? Math.min(...ages) : null;
  const active = latestDays !== null && latestDays <= 180;
  const oldLongViews = sum(data.videos.filter((video) => (age(video) ?? -1) > 180));
  const oldShortViews = sum(data.shorts.filter((video) => (age(video) ?? -1) > 180));
  const strong = longViews >= 100000 || shortViews >= 10000000;
  const moderate = longViews >= 25000 || shortViews >= 1000000;
  const oldStrong = oldLongViews >= 100000 || oldShortViews >= 10000000;
  const oldModerate = oldLongViews >= 25000 || oldShortViews >= 1000000;
  const low = items.length > 0 && items.every((video) => video.viewCount !== null) && views < 1000 && items.length < 500;
  const evidence = `${subscribers === null ? "Suscriptores no disponibles" : `${number.format(subscribers)} suscriptores`}; ${number.format(longViews)} vistas en videos y ${number.format(shortViews)} en Shorts recuperados.`;
  let current: Estimate;
  let historical: Estimate;

  if (subscribers === null || !items.length || items.every((video) => video.viewCount === null)) {
    current = result("Datos insuficientes", "Faltan suscriptores, vistas públicas o publicaciones para hacer una estimación útil.", "possible");
    historical = result("Datos insuficientes", "El historial visible no alcanza para estimar si monetizó antes.", "possible");
  } else {
    if (subscribers < 500 && low) {
      current = result("Probablemente no monetiza", "Está por debajo de 500 suscriptores y tiene menos de 1.000 vistas visibles: señales de un canal pequeño sin monetización de YouTube.", "unlikely");
      historical = result("Probablemente nunca monetizó", "La audiencia y el catálogo visibles son muy pequeños; no hay señales de una etapa anterior de monetización.", "unlikely");
    } else {
      if (subscribers >= 1000 && strong && active) {
        current = result("Probablemente monetiza", "Supera 1.000 suscriptores, tiene un volumen importante de vistas y publicó en los últimos 180 días. Es compatible con un canal monetizado.", "likely");
      } else if (subscribers >= 1000 && (strong || moderate)) {
        current = result("Posiblemente monetiza", active ? "Tiene suficientes suscriptores y cierto alcance, pero las señales de monetización todavía son moderadas." : "El alcance acumulado sugiere monetización, pero no vemos actividad reciente suficiente para estimar que siga activa. Los videos antiguos pueden seguir generando ingresos.", "possible");
      } else if (subscribers >= 500 && subscribers < 1000 && moderate) {
        current = result("Posible monetización inicial", "Podría acceder a apoyo de fans si cumple los demás requisitos. Está por debajo del mínimo actual de entrada a anuncios.", "possible");
      } else if (subscribers < 500 && strong) {
        current = result("Poco probable actualmente", "Tiene pocos suscriptores actuales, aunque el alcance acumulado deja abierta una etapa anterior con más audiencia.", "unlikely");
      } else {
        current = result("Probablemente no monetiza", "Las métricas recuperadas no combinan suficiente audiencia y alcance para sugerir monetización. Los suscriptores por sí solos no bastan.", "unlikely");
      }
      if (subscribers >= 1000 && oldStrong) {
        historical = result("Probablemente monetizó antes", "Supera 1.000 suscriptores y tiene mucho alcance en publicaciones de hace más de 180 días. Es una señal de una posible etapa monetizada, aunque las vistas podrían haber llegado después.", "likely");
      } else if (oldModerate || (subscribers < 1000 && oldStrong)) {
        historical = result("Posiblemente monetizó antes", "Las publicaciones antiguas tienen alcance relevante. No sabemos cuántos suscriptores tenía entonces ni cuándo obtuvo esas vistas.", "possible");
      } else if (strong || moderate) {
        historical = result("Sin señales históricas suficientes", "Hay alcance visible, pero no suficiente evidencia en publicaciones antiguas para inferir una etapa previa de monetización.", "possible");
      } else {
        historical = result("Probablemente nunca monetizó", "El catálogo recuperado tiene poco alcance como señal de una etapa monetizada. El contenido eliminado o privado podría cambiar esta estimación.", "unlikely");
      }
    }
  }
  return { current, historical, evidence, latestDays };
}

// Scenario assumptions in USD per 1,000 public views, not measured channel RPM.
export function estimateRevenue(data: YouTubeChannelMetrics) {
  const status = estimateMonetization(data);
  const items = [...data.videos, ...data.shorts];
  const available = items.some((item) => item.viewCount !== null);
  const now = Date.parse(data.fetchedAt);
  const recent = (item: YouTubeVideoMetric) => {
    if (!item.uploadDate || !/^\d{8}$/.test(item.uploadDate)) return false;
    const date = Date.parse(`${item.uploadDate.slice(0, 4)}-${item.uploadDate.slice(4, 6)}-${item.uploadDate.slice(6)}T00:00:00Z`);
    const days = (now - date) / 86400000;
    return days >= 0 && days <= 90;
  };
  const sum = (videos: YouTubeVideoMetric[]) => videos.reduce((value, item) => value + Math.max(0, item.viewCount ?? 0), 0);
  const range = (videos: YouTubeVideoMetric[], shorts: YouTubeVideoMetric[], coverage: number, divisor = 1) => ({
    low: (sum(videos) * 0.5 + sum(shorts) * 0.01) / 1000 * coverage / divisor,
    high: (sum(videos) * 5 + sum(shorts) * 0.2) / 1000 / divisor,
  });
  const recentVideos = data.videos.filter(recent);
  const recentShorts = data.shorts.filter(recent);
  const recentKnown = [...recentVideos, ...recentShorts].some((item) => item.viewCount !== null);
  const tiny = data.subscriberCount !== null && !data.hiddenSubscriberCount && data.subscriberCount < 500 && available && items.every((item) => item.viewCount !== null) && sum(items) < 1000;
  const zero = { low: 0, high: 0 };
  return {
    lifetime: !available ? null : tiny ? zero : range(data.videos, data.shorts, 0.25),
    monthly: !available ? null : tiny ? zero : recentKnown ? range(recentVideos, recentShorts, 1, 3) : null,
    tiny,
    conditional: status.current.tone !== "likely",
    recentViews: sum([...recentVideos, ...recentShorts]),
  };
}
