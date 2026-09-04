"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";
import { YouTubeSectionNav } from "./youtube-section-nav";
import type { YouTubeChannelMetrics, YouTubeVideoMetric } from "@/lib/youtube-metrics";

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
  const all = useMemo(() => data ? [...data.shorts, ...data.videos] : [], [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
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
      <section className="youtube-summary" aria-label="Resumen del canal"><article><span>Publicaciones</span><strong>{number.format(all.length)}</strong><small>{data.shorts.length} Shorts · {data.videos.length} videos</small></article><article><span>Vistas</span><strong>{number.format(total(all, "viewCount"))}</strong><small>total visible</small></article><article><span>Likes</span><strong>{number.format(total(all, "likeCount"))}</strong><small>total visible</small></article><article><span>Comentarios</span><strong>{number.format(total(all, "commentCount"))}</strong><small>total visible</small></article></section>
      <MonetizationPanel data={data}/>
      <p className="youtube-classification">Shorts se clasifica por duración de hasta 3 minutos; YouTube no publica un indicador exacto de formato Short en su API.</p>
      <MetricTable title="Shorts" accent="cyan" items={data.shorts}/>
      <MetricTable title="Videos" accent="yellow" items={data.videos}/>
    </>}
    {!data && !loading && <section className="youtube-empty"><span>▶</span><h2>Un canal, todas sus métricas.</h2><p>Los resultados aparecerán aquí separados entre Shorts y videos.</p></section>}
  </main>;
}

type YppStatus = "unknown" | "not-applied" | "review" | "approved" | "rejected";

function MonetizationPanel({ data }: { data: YouTubeChannelMetrics }) {
  const [watchHours, setWatchHours] = useState("");
  const [status, setStatus] = useState<YppStatus>("unknown");
  const storageKey = `youtube-monetization:${data.channel}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { watchHours?: string; status?: YppStatus };
      setWatchHours(saved.watchHours ?? "");
      setStatus(saved.status ?? "unknown");
    } catch { setWatchHours(""); setStatus("unknown"); }
  }, [storageKey]);
  function save(nextHours: string, nextStatus: YppStatus) {
    setWatchHours(nextHours); setStatus(nextStatus);
    localStorage.setItem(storageKey, JSON.stringify({ watchHours: nextHours, status: nextStatus }));
  }
  const hours = watchHours === "" ? null : Math.max(0, Number(watchHours) || 0);
  const subscribers = data.subscriberCount;
  const approved = status === "approved";
  const cutoff = new Date(data.fetchedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const recentUploads = [...data.shorts, ...data.videos].filter((item) => item.uploadDate && new Date(`${item.uploadDate.slice(0, 4)}-${item.uploadDate.slice(4, 6)}-${item.uploadDate.slice(6)}T00:00:00Z`) >= cutoff).length;
  const statusLabels: Record<YppStatus, string> = { unknown: "Sin confirmar", "not-applied": "Todavía no aplicado", review: "En revisión", approved: "Aprobado", rejected: "No aprobado" };
  return <section className="monetization-panel" aria-labelledby="monetization-title"><div className="monetization-heading"><div><p className="youtube-kicker">Estado actual</p><h2 id="monetization-title">Monetización</h2></div><strong className={approved ? "confirmed" : "pending"}><i/>{approved ? "Monetizando hoy" : "Aún no confirmado"}</strong></div><div className="monetization-levels"><article><span>Nivel 1</span><h3>Monetización inicial</h3><p><strong>500</strong> suscriptores · <strong>3</strong> publicaciones/90 días · <strong>3.000 h</strong></p><small>O 3 M de vistas válidas de Shorts en 90 días.</small><b className={subscribers !== null && subscribers >= 500 && recentUploads >= 3 && hours !== null && hours >= 3000 ? "reached" : ""}>{recentUploads}/3 publicaciones recientes</b></article><article><span>Nivel 2</span><h3>Anuncios</h3><p><strong>1.000</strong> suscriptores · <strong>4.000 h</strong></p><small>O 10 M de vistas válidas de Shorts en 90 días.</small><b className={subscribers !== null && subscribers >= 1000 && hours !== null && hours >= 4000 ? "reached" : ""}>Ingresos por anuncios</b></article></div><div className="monetization-cards"><article><div><span>Suscriptores</span><strong>{subscribers === null ? "—" : number.format(subscribers)}</strong><small>{data.hiddenSubscriberCount ? "El canal oculta este dato" : "Dato público de YouTube"}</small></div><div className="monetization-progress" aria-label={`${subscribers ?? 0} de 1000 suscriptores`}><i style={{ width: `${Math.min(100, (subscribers ?? 0) / 1000 * 100)}%` }}/></div><b>{subscribers === null ? "No disponible" : subscribers >= 1000 ? "Meta alcanzada" : `Faltan ${number.format(1000 - subscribers)}`} <em>/ 1.000</em></b></article><article><label htmlFor="valid-watch-hours">Horas públicas válidas</label><div className="monetization-input"><input id="valid-watch-hours" type="number" min="0" step="1" inputMode="numeric" value={watchHours} onChange={(event) => save(event.target.value, status)} placeholder="Ingresar desde Studio"/><span>h</span></div><div className="monetization-progress" aria-label={`${hours ?? 0} de 4000 horas válidas`}><i style={{ width: `${Math.min(100, (hours ?? 0) / 4000 * 100)}%` }}/></div><b>{hours === null ? "Dato privado pendiente" : hours >= 4000 ? "Meta alcanzada" : `Faltan ${number.format(4000 - hours)} h`} <em>/ 4.000 h</em></b></article><article><label htmlFor="ypp-status">Estado de aprobación YPP</label><select id="ypp-status" value={status} onChange={(event) => save(watchHours, event.target.value as YppStatus)}><option value="unknown">Sin confirmar</option><option value="not-applied">Todavía no aplicado</option><option value="review">En revisión</option><option value="approved">Aprobado</option><option value="rejected">No aprobado</option></select><strong className={`ypp-state ${status}`}>{statusLabels[status]}</strong><small>Copialo desde YouTube Studio → Ingresos</small></article></div><p className="monetization-note">Las horas válidas y la aprobación vienen de YouTube Studio y quedan guardadas solamente en este navegador. Las vistas del feed de Shorts no suman horas públicas válidas.</p></section>;
}

function MetricTable({ title, accent, items }: { title: string; accent: "cyan" | "yellow"; items: YouTubeVideoMetric[] }) {
  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [items]);
  const medianViews = median(items.flatMap((item) => item.viewCount === null ? [] : [item.viewCount]));
  const engagementValues = items.flatMap((item) => { const value = engagement(item); return value === null ? [] : [value]; });
  const averageEngagement = engagementValues.length ? engagementValues.reduce((sum, value) => sum + value, 0) / engagementValues.length : 0;
  const medianEngagement = median(engagementValues);
  const topEngagement = items.map((item) => ({ item, value: engagement(item) })).filter((entry): entry is { item: YouTubeVideoMetric; value: number } => entry.value !== null).sort((a, b) => b.value - a.value).slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return <section className={`youtube-results ${accent}`}><div className="youtube-results-heading"><div><p className="youtube-kicker">{items.length} publicaciones</p><h2>{title}</h2></div><span>{number.format(total(items, "viewCount"))} vistas</span></div>{items.length ? <>
    <div className="youtube-analysis"><article><span>Mediana de vistas</span><strong>{number.format(medianViews)}</strong><small>base del rendimiento relativo</small></article><article><span>Engagement promedio</span><strong>{averageEngagement.toFixed(2)}%</strong><small>likes + comentarios sobre vistas</small></article><article><span>Engagement mediano</span><strong>{medianEngagement.toFixed(2)}%</strong><small>punto medio del canal</small></article></div>
    {title === "Videos" && <VideoViewsChart items={items}/>} 
    <div className="youtube-table-wrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Vistas</th><th>Likes</th><th>Comentarios</th><th>Duración</th><th></th></tr></thead><tbody>{pageItems.map((item, index) => { const multiplier = medianViews > 0 && item.viewCount !== null ? item.viewCount / medianViews : 0; const rating = performanceLabel(multiplier); const rate = engagement(item); return <tr key={`${item.url}-${index}`} tabIndex={0}><td>{formatDate(item.uploadDate)}</td><td className="video-title-cell"><strong>{item.title}</strong><div className={`row-insight ${rating.className}`} role="tooltip"><b>{rating.icon} {rating.label}</b><span><strong>{multiplier.toFixed(1)}x</strong> la mediana de vistas</span><span><strong>{rate === null ? "—" : `${rate.toFixed(2)}%`}</strong> de engagement</span><small>{number.format((item.likeCount ?? 0) + (item.commentCount ?? 0))} interacciones visibles</small></div></td><td>{item.viewCount === null ? "—" : number.format(item.viewCount)}</td><td>{item.likeCount === null ? "—" : number.format(item.likeCount)}</td><td>{item.commentCount === null ? "—" : number.format(item.commentCount)}</td><td>{formatDuration(item.duration)}</td><td><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.title} en YouTube`}>↗</a></td></tr>; })}</tbody></table></div>
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
