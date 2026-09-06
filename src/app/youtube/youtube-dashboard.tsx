"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";
import { YouTubeSectionNav } from "./youtube-section-nav";
import type { YouTubeChannelMetrics, YouTubeVideoMetric } from "@/lib/youtube-metrics";
import { estimateMonetization } from "@/lib/youtube-monetization";

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
      <section className="youtube-summary" aria-label="Resumen del canal"><article><span>Publicaciones</span><strong>{number.format(all.length)}</strong><small>{data.shorts.length} Shorts · {data.videos.length} videos</small></article><article><span>Vistas</span><strong>{number.format(total(all, "viewCount"))}</strong><small>total visible</small></article><article><span>Likes</span><strong>{number.format(total(all, "likeCount"))}</strong><small>total visible</small></article><article><span>Comentarios</span><strong>{number.format(total(all, "commentCount"))}</strong><small>total visible</small></article></section>
      <MonetizationPanel data={data}/>
      <p className="youtube-classification">Shorts se clasifica por duración de hasta 3 minutos; YouTube no publica un indicador exacto de formato Short en su API.</p>
      <MetricTable title="Shorts" accent="cyan" items={data.shorts}/>
      <MetricTable title="Videos" accent="yellow" items={data.videos}/>
    </>}
    {!data && !loading && <section className="youtube-empty"><span>▶</span><h2>Un canal, todas sus métricas.</h2><p>Los resultados aparecerán aquí separados entre Shorts y videos.</p></section>}
  </main>;
}

function MonetizationPanel({ data }: { data: YouTubeChannelMetrics }) {
  const subscribers = data.subscriberCount;
  const fetchedAt = new Date(data.fetchedAt);
  const cutoff = new Date(fetchedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const cutoffDate = cutoff.toISOString().slice(0, 10).replaceAll("-", "");
  const endDate = data.fetchedAt.slice(0, 10).replaceAll("-", "");
  const recentUploads = [...data.shorts, ...data.videos].filter((item) => item.uploadDate && item.uploadDate >= cutoffDate && item.uploadDate <= endDate).length;
  const updatedThresholds = data.fetchedAt >= "2027-02-01";
  const adsHours = updatedThresholds ? "8.000" : "4.000";
  const adsShorts = updatedThresholds ? "20 M" : "10 M";
  const subscriberStatus = (goal: number) => subscribers === null ? "Suscriptores: dato no disponible" : subscribers >= goal ? "Mínimo de suscriptores alcanzado" : `Faltan ${number.format(goal - subscribers)} suscriptores`;
  const country = data.country && /^[A-Z]{2}$/.test(data.country) ? new Intl.DisplayNames(["es"], { type: "region" }).of(data.country) : null;
  const estimate = estimateMonetization(data);
  return <section className="monetization-panel" aria-labelledby="monetization-title">
    <div className="monetization-heading"><div><p className="youtube-kicker">Estimación y requisitos</p><h2 id="monetization-title">Monetización del canal</h2></div></div>
    <p className="monetization-note">Estimación orientativa basada en métricas públicas. No es una confirmación de YouTube ni incluye patrocinios o afiliados externos.</p>
    <div className="monetization-status-grid">
      <article className={estimate.current.tone}><h3>Monetización actual · estimada</h3><strong>{estimate.current.label}</strong><p>{estimate.current.reason}</p></article>
      <article className={estimate.historical.tone}><h3>Monetización histórica · estimada</h3><strong>{estimate.historical.label}</strong><p>{estimate.historical.reason}</p></article>
    </div>
    <p className="monetization-note">{estimate.evidence} {estimate.latestDays === null ? "Sin fecha de publicación disponible." : `Última publicación recuperada: hace ${Math.floor(estimate.latestDays)} días.`}</p>
    <details className="monetization-details"><summary>Cómo llegamos a esta estimación</summary><p>Combinamos suscriptores, vistas acumuladas, formato y antigüedad de las publicaciones. No dependemos de un estado privado de la API.</p><ul><li>Menos de 500 suscriptores y menos de 1.000 vistas visibles: probablemente no monetiza ni lo hizo antes.</li><li>Desde 1.000 suscriptores, 100.000 vistas en videos o 10 millones en Shorts y publicaciones en los últimos 180 días: probablemente monetiza.</li><li>25.000 vistas en videos o un millón en Shorts son señales moderadas. Entre 500 y 999 suscriptores pueden sugerir acceso inicial, no entrada a anuncios.</li><li>Si el alcance fuerte está en publicaciones de hace más de 180 días, aumenta la señal de monetización histórica. Sin actividad reciente, la estimación actual baja a posible.</li></ul><p>Estos cortes son reglas orientativas de este panel, no requisitos oficiales ni probabilidades estadísticas. Las vistas en videos antiguos podrían ser recientes; no conocemos la retención, los suscriptores históricos ni la aprobación. Shorts se identifica de forma aproximada por duración.</p><p>Solo evaluamos las publicaciones recuperadas: un catálogo parcial, videos eliminados o privados pueden cambiar el resultado. Bajar de suscriptores no cancela automáticamente una monetización anterior y no publicar videos no prueba inactividad total. <a href="https://support.google.com/youtube/answer/9235997?hl=es" target="_blank" rel="noopener noreferrer">Aclaraciones de YouTube ↗</a></p></details>
    <div className="monetization-public"><div><span>Suscriptores públicos actuales</span><strong>{subscribers === null ? "—" : number.format(subscribers)}</strong><small>{data.hiddenSubscriberCount ? "El canal oculta este dato" : "Cifra pública redondeada por YouTube"}</small></div><div><p><b>{country ?? "No informado"}</b>País declarado por el canal</p></div></div>
    <details className="monetization-details" open><summary>Requisitos para solicitar acceso</summary>
      <p className="monetization-note">Alcanzar estas cifras permite solicitar acceso; YouTube revisa el canal y exige cumplir sus políticas, configurar la cuenta y aceptar los módulos correspondientes. No equivale a estar aprobado.</p>
      <div className="monetization-levels">
        <article><span>Acceso inicial · donde esté disponible</span><h3>Apoyo de fans y Shopping</h3><p><strong>500</strong> suscriptores + <strong>3</strong> publicaciones públicas en 90 días, y una de estas opciones:</p><ul><li><strong>3.000 horas</strong> públicas válidas en los últimos 12 meses.</li><li><strong>3 M de vistas</strong> válidas de Shorts en 90 días.</li></ul><b>{subscriberStatus(500)}</b><small>{recentUploads >= 3 ? `Mínimo de publicaciones observado: ${recentUploads} de 3 requeridas` : `${recentUploads} publicaciones recientes encontradas; no se puede confirmar el mínimo de 3`}</small><small>Conteo limitado a las publicaciones recuperadas y a su fecha pública.</small><p className="monetization-note">Las membresías, los Supers y Shopping tienen requisitos adicionales. Este acceso no incluye el reparto de anuncios.</p></article>
        <article><span>Acceso a anuncios y Premium</span><h3>Reparto de ingresos</h3><p><strong>1.000</strong> suscriptores y una de estas opciones:</p><ul><li><strong>{adsHours} horas</strong> públicas válidas en los últimos 12 meses.</li><li><strong>{adsShorts} de vistas</strong> válidas de Shorts en 90 días.</li></ul><b>{subscriberStatus(1000)}</b><small>Horas y vistas válidas: no verificables con esta consulta.</small><p className="monetization-note">Los mínimos de suscriptores son solo una parte de la evaluación.</p></article>
      </div>
      <p className="monetization-note">Las horas del feed de Shorts no cuentan para la vía de horas. Las vistas acumuladas de los videos no indican las vistas válidas obtenidas en los últimos 90 días. La clasificación de Shorts por duración es aproximada y no sirve para certificar elegibilidad.</p>
      <p className="monetization-note">Reglas revisadas el 6 de septiembre de 2026. {updatedThresholds ? "Se muestran los umbrales anunciados para nuevas solicitudes desde febrero de 2027." : "YouTube anunció para el 1 de febrero de 2027 nuevos mínimos de entrada a anuncios: 8.000 horas o 20 M de vistas válidas de Shorts, manteniendo 1.000 suscriptores."} <a href="https://support.google.com/youtube/answer/12843009?hl=en" target="_blank" rel="noopener noreferrer">Cambios y fechas oficiales ↗</a></p>
    </details>
    <details className="monetization-details"><summary>País, idioma y formas de ganar dinero</summary><p>Los mínimos publicados no cambian por idioma. La disponibilidad del programa y de sus funciones depende del país o territorio. El país declarado del canal no acredita la residencia del propietario ni confirma elegibilidad.</p><p>El idioma por sí solo no permite calcular ingresos. El país de la audiencia, la demanda publicitaria y los formatos de anuncios influyen en lo que se paga.</p><p>Además de anuncios y Premium, existen membresías, Supers y Shopping. Los patrocinios y enlaces de afiliados externos tampoco se pueden confirmar con estas métricas.</p><p><a href="https://support.google.com/youtube/answer/13429240?hl=es" target="_blank" rel="noopener noreferrer">Países y acceso inicial ↗</a> · <a href="https://support.google.com/youtube/answer/72857?hl=es" target="_blank" rel="noopener noreferrer">Requisitos por función ↗</a> · <a href="https://support.google.com/youtube/answer/9314357?hl=es" target="_blank" rel="noopener noreferrer">Cómo se calculan los ingresos ↗</a></p></details>
    <details className="monetization-details"><summary>Cómo confirmar el estado y los ingresos</summary><p>Si el canal es tuyo, seleccioná ese canal en YouTube Studio: revisá Ingresos para el estado del programa y Analytics → Ingresos para los importes y períodos anteriores disponibles. Si es de otra persona, necesitás que comparta esos registros.</p><a href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer">Abrir mi YouTube Studio ↗</a></details>
    <p className="monetization-note">Consulta del canal: {new Intl.DateTimeFormat("es-UY", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(fetchedAt)} UTC. Las estimaciones se recalculan con cada consulta.</p>
  </section>;
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
