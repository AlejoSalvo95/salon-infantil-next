"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";
import { YouTubeSectionNav } from "./youtube-section-nav";
import type { YouTubeChannelMetrics, YouTubeVideoMetric } from "@/lib/youtube-metrics";
import { estimateMonetization, estimateRevenue } from "@/lib/youtube-monetization";

const number = new Intl.NumberFormat("es-UY");

function formatDate(value: string | null) {
  if (!value || !/^\d{8}$/.test(value)) return "—";
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}T12:00:00`);
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function total(items: YouTubeVideoMetric[], key: "viewCount" | "likeCount" | "commentCount") {
  return items.reduce((sum, item) => sum + (item[key] ?? 0), 0);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function engagement(item: YouTubeVideoMetric) {
  return item.viewCount && item.viewCount > 0 ? ((item.likeCount ?? 0) + (item.commentCount ?? 0)) / item.viewCount * 100 : null;
}

function performanceLabel(multiplier: number) {
  if (multiplier < .5) return { label: "Bajo", className: "low", icon: "●" };
  if (multiplier < 1) return { label: "Normal", className: "normal", icon: "●" };
  if (multiplier < 3) return { label: "Bueno", className: "good", icon: "●" };
  return { label: "Viral", className: "viral", icon: "🔥" };
}

export function YouTubeDashboard() {
  const [channel, setChannel] = useState("@heathclaydon");
  const [data, setData] = useState<YouTubeChannelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const all = useMemo(() => data ? [...data.shorts, ...data.videos, ...(data.unclassified ?? [])] : [], [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedChannel = channel.trim();
    setChannel(trimmedChannel);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: trimmedChannel }) });
      const payload = await response.json() as YouTubeChannelMetrics & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo analizar el canal.");
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo analizar el canal.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="youtube-page">
    <header className="youtube-header"><a className="plants-logo" href="/">☁ nube</a><PrivateAreaNav current="youtube" /></header>
    <YouTubeSectionNav current="analytics" />
    <section className="youtube-intro">
      <div><p className="youtube-kicker">Channel intelligence</p><h1>YouTube<br/><em>metrics.</em></h1><p>Ingresá un @handle o pegá la URL de un canal para analizar sus Shorts y videos públicos.</p></div>
      <form onSubmit={submit}><label htmlFor="channel">Canal de YouTube</label><div><input id="channel" value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="@umarstar123" required/><button disabled={loading}>{loading ? "Analizando…" : "Analizar canal"}</button></div><small>La consulta puede tardar uno o dos minutos según la cantidad de publicaciones.</small></form>
    </section>
    {error && <p className="youtube-error" role="alert">{error}</p>}
    {data && <>
      <p className="youtube-channel-link">Canal analizado: <a href={data.channel} target="_blank" rel="noopener noreferrer" aria-label={`Abrir el canal ${data.channel.replace("https://www.youtube.com/", "")} en YouTube (nueva pestaña)`}>{data.channel.replace("https://www.youtube.com/", "")} ↗</a></p>
      <section className="youtube-summary" aria-label="Resumen del canal"><article><span>Publicaciones</span><strong>{number.format(all.length)}</strong><small>{data.shorts.length} Shorts · {data.videos.length} videos{data.unclassified?.length ? ` · ${data.unclassified.length} sin clasificar` : ""}</small></article><article><span>Vistas</span><strong>{number.format(total(all, "viewCount"))}</strong><small>total visible</small></article><article><span>Likes</span><strong>{number.format(total(all, "likeCount"))}</strong><small>total visible</small></article><article><span>Comentarios</span><strong>{number.format(total(all, "commentCount"))}</strong><small>total visible</small></article></section>
      <MonetizationPanel data={data}/>
      <p className="youtube-classification">Formato confirmado por las pestañas públicas Shorts, Videos y En vivo del canal. Si YouTube no permite verificar una publicación, queda sin clasificar y fuera de las estimaciones de ingresos.</p>
      <MetricTable title="Shorts" accent="cyan" items={data.shorts}/>
      <MetricTable title="Videos" accent="yellow" items={data.videos}/>
      {!!data.unclassified?.length && <MetricTable title="Sin clasificar" accent="yellow" items={data.unclassified}/>}
      <details className="youtube-api-data">
        <summary>Ver respuestas originales de YouTube</summary>
        <p>Cuerpos JSON originales recibidos de Google, antes de transformar o clasificar los datos. Cada entrada incluye el recurso, los parámetros sin la clave y el estado HTTP. Se incluyen todas las páginas y lotes consultados, dentro del límite de publicaciones configurado; no campos ni páginas que no se hayan solicitado.</p>
        <div className="youtube-json-viewer" key={data.fetchedAt} aria-label="Respuestas JSON desplegables">{data.rawResponses.map((response, index) => <JsonNode key={index} name={`${index + 1}. ${response.resource}`} value={response}/>)}</div>
      </details>
    </>}
    {!data && !loading && <section className="youtube-empty"><span>▶</span><h2>Un canal, todas sus métricas.</h2><p>Los resultados aparecerán aquí separados entre Shorts y videos.</p></section>}
  </main>;
}

function JsonNode({ name, value }: { name: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    const array = Array.isArray(value);
    return <details className="youtube-json-node" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary><span className="youtube-json-key">{name}</span>: <span className="youtube-json-count">{array ? `[${entries.length} elementos]` : `{${entries.length} propiedades}`}</span></summary>
      {expanded && <div className="youtube-json-children">{entries.length ? entries.map(([key, child]) => <JsonNode key={key} name={array ? `[${key}]` : key} value={child}/>) : <span>{array ? "[]" : "{}"}</span>}</div>}
    </details>;
  }
  return <div className="youtube-json-leaf"><span className="youtube-json-key">{name}</span>: <span className={`youtube-json-value ${value === null ? "null" : typeof value}`}>{JSON.stringify(value) ?? "undefined"}</span></div>;
}

function MonetizationPanel({ data }: { data: YouTubeChannelMetrics }) {
  const estimate = estimateMonetization(data);
  const revenue = estimateRevenue(data);
  const money = new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 2 });
  const amount = (value: { low: number; high: number } | null) => value === null ? "Sin base suficiente" : value.high === 0 ? "≈ USD 0" : `${money.format(value.low)} – ${money.format(value.high)}`;
  return <section className="monetization-panel" aria-labelledby="monetization-title">
    <div className="monetization-heading"><div><p className="youtube-kicker">Ingresos aproximados · USD</p><h2 id="monetization-title">¿Cuánto gana?</h2></div></div>
    <div className="monetization-status-grid"><article className={estimate.current.tone}><h3>Monetización actual · estimada</h3><strong>{estimate.current.label}</strong><p>{estimate.current.reason}</p></article></div>
    <div className="youtube-revenue-grid">
      <article><h3>Ritmo mensual aproximado</h3><strong>{amount(revenue.monthly)}</strong><p>{revenue.tiny ? "Estimación cercana a cero por la audiencia y el alcance mínimos del canal." : revenue.monthly ? `Basado en ${number.format(revenue.recentViews)} vistas de publicaciones de los últimos 90 días, dividido entre 3. Solo representa ese contenido reciente; no el ingreso mensual total del canal.` : "No hay publicaciones recientes con vistas disponibles para calcular un ritmo. El catálogo antiguo podría seguir generando ingresos."}</p></article>
      <article><h3>Acumulado potencial del catálogo</h3><strong>{amount(revenue.lifetime)}</strong><p>{revenue.tiny ? "Probablemente no generó ingresos de YouTube con el catálogo visible." : "Aproximación de lo que pudo generar el contenido recuperado si estuvo monetizado. Desconocemos desde cuándo: usamos escenarios de 25% a 100% de las vistas bajo monetización, no un historial de cobros."}</p></article>
    </div>
    {!revenue.tiny && <p className="monetization-note">{revenue.conditional ? "Los importes suponen monetización activa; si no la tuvo, el ingreso real puede ser USD 0." : "Rangos orientativos, no ingresos confirmados. Incluso con señales favorables, el ingreso real puede ser USD 0."} No incluyen patrocinios, afiliados, membresías ni Supers.</p>}
    {estimate.historical.label === "Probablemente nunca monetizó" && <details className="monetization-details"><summary>Ver estimación histórica</summary><p><strong>{estimate.historical.label}</strong></p><p>{estimate.historical.reason}</p></details>}
    <details className="monetization-details"><summary>Cómo calculamos los importes</summary><p>Supuestos del panel por cada 1.000 vistas públicas: videos, USD 0,50–5; Shorts, USD 0,01–0,20. Son escenarios amplios de ingresos de anuncios y Premium después del reparto de YouTube, antes de impuestos; no tarifas medidas de este canal ni límites garantizados.</p><p>Acumulado: vistas × ingreso supuesto por mil vistas × cobertura de monetización (25% en el escenario bajo; 100% en el alto). Ritmo mensual: valor de las vistas acumuladas en publicaciones de hasta 90 días ÷ 3. No extrapolamos un día de actividad a un mes ni atribuimos todas las vistas antiguas al presente.</p><p>No tenemos las vistas mensuales de videos antiguos ni las fechas reales de monetización. El acumulado puede incluir ingresos recientes y no se suma al ritmo mensual. El país de la audiencia, el tema y la proporción de vistas válidas cambian el resultado; no los deducimos del país declarado ni del idioma. El formato se verifica en las pestañas del canal. Las publicaciones sin clasificar se excluyen de estos importes; las vistas públicas de Shorts no equivalen a vistas elegibles.</p><p>Referencia para la diferencia entre formatos: <a href="https://air.io/en/air-data-findings/youtube-shorts-rpm-vs-long-form-how-much-do-shorts-earn-in-2026" target="_blank" rel="noopener noreferrer">datos de AIR ↗</a>. <a href="https://support.google.com/youtube/answer/9314357?hl=es" target="_blank" rel="noopener noreferrer">Definición de ingresos por mil vistas ↗</a>. Los rangos y la cobertura usados aquí son supuestos propios, no valores oficiales.</p><p>{estimate.evidence} Un catálogo parcial o contenido eliminado puede alterar la estimación. Para el estado aproximado combinamos suscriptores, alcance y actividad reciente; superar los mínimos no prueba que YouTube haya aprobado el canal.</p></details>
  </section>;
}

const metricColumns = [
  { key: "uploadDate", label: "Fecha" },
  { key: "title", label: "Título" },
  { key: "viewCount", label: "Vistas" },
  { key: "likeCount", label: "Likes" },
  { key: "commentCount", label: "Comentarios" },
  { key: "duration", label: "Duración" },
] as const;
type MetricSortKey = typeof metricColumns[number]["key"];

function sortMetrics(items: YouTubeVideoMetric[], key: MetricSortKey, direction: "asc" | "desc") {
  return [...items].sort((a, b) => {
    const left = a[key], right = b[key];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "es", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

function MetricTable({ title, accent, items }: { title: string; accent: "cyan" | "yellow"; items: YouTubeVideoMetric[] }) {
  const pageSize = 10;
  const [sort, setSort] = useState<{ key: MetricSortKey; direction: "asc" | "desc" }>({ key: "viewCount", direction: "desc" });
  const sortedItems = useMemo(() => sortMetrics(items, sort.key, sort.direction), [items, sort]);
  function changeSort(key: MetricSortKey) {
    setSort((current) => ({ key, direction: current.key === key ? (current.direction === "asc" ? "desc" : "asc") : key === "title" ? "asc" : "desc" }));
    setPage(1);
  }
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [items]);
  const medianViews = median(items.flatMap((item) => item.viewCount === null ? [] : [item.viewCount]));
  const engagementValues = items.flatMap((item) => { const value = engagement(item); return value === null ? [] : [value]; });
  const averageEngagement = engagementValues.length ? engagementValues.reduce((sum, value) => sum + value, 0) / engagementValues.length : 0;
  const medianEngagement = median(engagementValues);
  const topEngagement = items.map((item) => ({ item, value: engagement(item) })).filter((entry): entry is { item: YouTubeVideoMetric; value: number } => entry.value !== null).sort((a, b) => b.value - a.value).slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return <section className={`youtube-results ${accent}`}><div className="youtube-results-heading"><div><p className="youtube-kicker">{items.length} publicaciones</p><h2>{title}</h2></div><span>{number.format(total(items, "viewCount"))} vistas</span></div>{items.length ? <>
    <div className="youtube-analysis"><article><span>Mediana de vistas</span><strong>{number.format(medianViews)}</strong><small>base del rendimiento relativo</small></article><article><span>Engagement promedio</span><strong>{averageEngagement.toFixed(2)}%</strong><small>likes + comentarios sobre vistas</small></article><article><span>Engagement mediano</span><strong>{medianEngagement.toFixed(2)}%</strong><small>punto medio del canal</small></article></div>
    {title === "Videos" && <VideoViewsChart items={items}/>} 
    <div className="youtube-table-wrap"><table><thead><tr><>{metricColumns.map(({ key, label }) => <th key={key} scope="col" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><button type="button" className="youtube-sort-button" onClick={() => changeSort(key)} aria-label={`Ordenar por ${label}: ${sort.key === key ? (sort.direction === "asc" ? "descendente" : "ascendente") : key === "title" ? "ascendente" : "descendente"}`}>{label} <span aria-hidden="true">{sort.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>)}</><th scope="col" aria-label="Abrir en YouTube"></th></tr></thead><tbody>{pageItems.map((item, index) => { const multiplier = medianViews > 0 && item.viewCount !== null ? item.viewCount / medianViews : 0; const rating = performanceLabel(multiplier); const rate = engagement(item); return <tr key={`${item.url}-${index}`} tabIndex={0}><td>{formatDate(item.uploadDate)}</td><td className="video-title-cell"><strong>{item.title}</strong><div className={`row-insight ${rating.className}`} role="tooltip"><b>{rating.icon} {rating.label}</b><span><strong>{multiplier.toFixed(1)}x</strong> la mediana de vistas</span><span><strong>{rate === null ? "—" : `${rate.toFixed(2)}%`}</strong> de engagement</span><small>{number.format((item.likeCount ?? 0) + (item.commentCount ?? 0))} interacciones visibles</small></div></td><td>{item.viewCount === null ? "—" : number.format(item.viewCount)}</td><td>{item.likeCount === null ? "—" : number.format(item.likeCount)}</td><td>{item.commentCount === null ? "—" : number.format(item.commentCount)}</td><td>{formatDuration(item.duration)}</td><td><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.title} en YouTube`}>↗</a></td></tr>; })}</tbody></table></div>
    {totalPages > 1 && <nav className="youtube-pagination" aria-label={`Paginación de ${title}`}><span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, items.length)} de {items.length}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label={`Página anterior de ${title}`}>← Anterior</button><strong>Página {currentPage} de {totalPages}</strong><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} aria-label={`Página siguiente de ${title}`}>Siguiente →</button></div></nav>}
    <div className="engagement-top"><div><p className="youtube-kicker">Ranking</p><h3>Top 10 por engagement</h3></div><ol>{topEngagement.map(({ item, value }) => <li key={item.url}><span><strong>{item.title}</strong><small>{item.viewCount === null ? "Sin vistas" : `${number.format(item.viewCount)} vistas`}</small></span><b>{value.toFixed(2)}%</b></li>)}</ol></div>
  </> : <p className="youtube-no-results">No se encontraron publicaciones públicas en esta sección.</p>}</section>;
}

function VideoViewsChart({ items }: { items: YouTubeVideoMetric[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(650, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  const data = items
    .filter((item) => item.uploadDate && /^\d{8}$/.test(item.uploadDate))
    .sort((a, b) => a.uploadDate!.localeCompare(b.uploadDate!))
    .map((item) => ({ item, views: item.viewCount ?? 0, time: new Date(`${item.uploadDate!.slice(0, 4)}-${item.uploadDate!.slice(4, 6)}-${item.uploadDate!.slice(6)}T12:00:00`).getTime() }));
  if (!data.length) return null;
  const height = width < 760 ? 330 : 350, left = 68, right = 24, top = 28, bottom = 58;
  const maxViews = Math.max(1, ...data.map((point) => point.views));
  const minTime = data[0].time, maxTime = data.at(-1)!.time;
  const x = (time: number) => minTime === maxTime ? left + (width - left - right) / 2 : left + (time - minTime) / (maxTime - minTime) * (width - left - right);
  const y = (views: number) => top + (1 - views / maxViews) * (height - top - bottom);
  const line = data.map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)},${y(point.views).toFixed(1)}`).join(" ");
  const labelCount = Math.min(6, data.length);
  const labelIndexes = Array.from(new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (data.length - 1) / Math.max(labelCount - 1, 1)))));
  const activeIndex = hovered ?? data.length - 1, active = data[activeIndex];
  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = ((event.clientX - bounds.left) / bounds.width) * width; let nearest = 0, distance = Infinity; data.forEach((point, index) => { const next = Math.abs(x(point.time) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }
  return <div className="performance-chart"><div className="performance-chart-head"><div><p className="youtube-kicker">Videos por fecha de publicación</p><h3>Vistas de cada video</h3></div><div className="performance-legend"><span><i className="relative-line"/>Cantidad de vistas</span></div></div><div className="youtube-chart-value" aria-live="polite"><strong>{number.format(active.views)} <small>vistas</small></strong><span>{formatDate(active.item.uploadDate)} · {active.item.title}</span></div><div className="youtube-chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cantidad de vistas de cada video según su fecha de publicación">{[0,.25,.5,.75,1].map((part) => <g key={part}><line className="performance-grid" x1={left} x2={width-right} y1={top+part*(height-top-bottom)} y2={top+part*(height-top-bottom)}/><text className="performance-axis left" x={left-10} y={top+(1-part)*(height-top-bottom)+4}>{number.format(Math.round(maxViews*part))}</text></g>)}<path className="relative-path" d={line}/>{data.map((point) => <circle key={point.item.url} className="relative-dot" cx={x(point.time)} cy={y(point.views)} r="4"/>)}{labelIndexes.map((index) => <text key={data[index].item.url} className="performance-axis date" x={x(data[index].time)} y={height-14}>{formatDate(data[index].item.uploadDate)}</text>)}<line className="youtube-hover-guide" x1={x(active.time)} x2={x(active.time)} y1={top} y2={height-bottom}/><circle className="youtube-hover-dot" cx={x(active.time)} cy={y(active.views)} r="7"/><rect className="youtube-chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div></div>;
}
