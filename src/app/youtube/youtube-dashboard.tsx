"use client";

import { FormEvent, useMemo, useState } from "react";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";
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
  const [channel, setChannel] = useState("@umarstar123");
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
    <section className="youtube-intro">
      <div><p className="youtube-kicker">Channel intelligence</p><h1>YouTube<br/><em>metrics.</em></h1><p>Ingresá un @handle o pegá la URL de un canal para analizar sus Shorts y videos públicos.</p></div>
      <form onSubmit={submit}><label htmlFor="channel">Canal de YouTube</label><div><input id="channel" value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="@umarstar123" required/><button disabled={loading}>{loading ? "Analizando…" : "Analizar canal"}</button></div><small>La consulta puede tardar uno o dos minutos según la cantidad de publicaciones.</small></form>
    </section>
    {error && <p className="youtube-error" role="alert">{error}</p>}
    {data && <>
      <section className="youtube-summary" aria-label="Resumen del canal"><article><span>Publicaciones</span><strong>{number.format(all.length)}</strong><small>{data.shorts.length} Shorts · {data.videos.length} videos</small></article><article><span>Vistas</span><strong>{number.format(total(all, "viewCount"))}</strong><small>total visible</small></article><article><span>Likes</span><strong>{number.format(total(all, "likeCount"))}</strong><small>total visible</small></article><article><span>Comentarios</span><strong>{number.format(total(all, "commentCount"))}</strong><small>total visible</small></article></section>
      <p className="youtube-classification">Shorts se clasifica por duración de hasta 3 minutos; YouTube no publica un indicador exacto de formato Short en su API.</p>
      <MetricTable title="Shorts" accent="cyan" items={data.shorts}/>
      <MetricTable title="Videos" accent="yellow" items={data.videos}/>
    </>}
    {!data && !loading && <section className="youtube-empty"><span>▶</span><h2>Un canal, todas sus métricas.</h2><p>Los resultados aparecerán aquí separados entre Shorts y videos.</p></section>}
  </main>;
}

function MetricTable({ title, accent, items }: { title: string; accent: "cyan" | "yellow"; items: YouTubeVideoMetric[] }) {
  const medianViews = median(items.flatMap((item) => item.viewCount === null ? [] : [item.viewCount]));
  const engagementValues = items.flatMap((item) => { const value = engagement(item); return value === null ? [] : [value]; });
  const averageEngagement = engagementValues.length ? engagementValues.reduce((sum, value) => sum + value, 0) / engagementValues.length : 0;
  const medianEngagement = median(engagementValues);
  const topEngagement = items.map((item) => ({ item, value: engagement(item) })).filter((entry): entry is { item: YouTubeVideoMetric; value: number } => entry.value !== null).sort((a, b) => b.value - a.value).slice(0, 10);

  return <section className={`youtube-results ${accent}`}><div className="youtube-results-heading"><div><p className="youtube-kicker">{items.length} publicaciones</p><h2>{title}</h2></div><span>{number.format(total(items, "viewCount"))} vistas</span></div>{items.length ? <>
    <div className="youtube-analysis"><article><span>Mediana de vistas</span><strong>{number.format(medianViews)}</strong><small>base del rendimiento relativo</small></article><article><span>Engagement promedio</span><strong>{averageEngagement.toFixed(2)}%</strong><small>likes + comentarios sobre vistas</small></article><article><span>Engagement mediano</span><strong>{medianEngagement.toFixed(2)}%</strong><small>punto medio del canal</small></article></div>
    <PerformanceChart items={items}/>
    <div className="youtube-table-wrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Vistas</th><th>Likes</th><th>Comentarios</th><th>Duración</th><th></th></tr></thead><tbody>{items.map((item, index) => { const multiplier = medianViews > 0 && item.viewCount !== null ? item.viewCount / medianViews : 0; const rating = performanceLabel(multiplier); const rate = engagement(item); return <tr key={`${item.url}-${index}`} tabIndex={0}><td>{formatDate(item.uploadDate)}</td><td className="video-title-cell"><strong>{item.title}</strong><div className={`row-insight ${rating.className}`} role="tooltip"><b>{rating.icon} {rating.label}</b><span><strong>{multiplier.toFixed(1)}x</strong> la mediana de vistas</span><span><strong>{rate === null ? "—" : `${rate.toFixed(2)}%`}</strong> de engagement</span><small>{number.format((item.likeCount ?? 0) + (item.commentCount ?? 0))} interacciones visibles</small></div></td><td>{item.viewCount === null ? "—" : number.format(item.viewCount)}</td><td>{item.likeCount === null ? "—" : number.format(item.likeCount)}</td><td>{item.commentCount === null ? "—" : number.format(item.commentCount)}</td><td>{formatDuration(item.duration)}</td><td><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.title} en YouTube`}>↗</a></td></tr>; })}</tbody></table></div>
    <div className="engagement-top"><div><p className="youtube-kicker">Ranking</p><h3>Top 10 por engagement</h3></div><ol>{topEngagement.map(({ item, value }) => <li key={item.url}><span><strong>{item.title}</strong><small>{item.viewCount === null ? "Sin vistas" : `${number.format(item.viewCount)} vistas`}</small></span><b>{value.toFixed(2)}%</b></li>)}</ol></div>
  </> : <p className="youtube-no-results">No se encontraron publicaciones públicas en esta sección.</p>}</section>;
}

function PerformanceChart({ items }: { items: YouTubeVideoMetric[] }) {
  const data = [...items].reverse().map((item) => ({ item, views: item.viewCount ?? 0, rate: engagement(item) ?? 0 }));
  const width = 1000, height = 350, left = 58, right = 58, top = 28, bottom = 48;
  const maxViews = Math.max(1, ...data.map((point) => point.views));
  const maxRate = Math.max(1, ...data.map((point) => point.rate));
  const x = (index: number) => left + index / Math.max(data.length - 1, 1) * (width - left - right);
  const yViews = (value: number) => top + (1 - value / maxViews) * (height - top - bottom);
  const yRate = (value: number) => top + (1 - value / maxRate) * (height - top - bottom);
  const line = (key: "views" | "rate", scale: (value: number) => number) => data.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${scale(point[key]).toFixed(1)}`).join(" ");
  const first = data[0]?.item.uploadDate ?? null, last = data.at(-1)?.item.uploadDate ?? null;
  return <div className="performance-chart"><div className="performance-chart-head"><div><p className="youtube-kicker">Evolución por publicación</p><h3>Vistas y engagement</h3></div><div className="performance-legend"><span><i className="relative-line"/>Cantidad de vistas</span><span><i className="engagement-line"/>Engagement</span></div></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curvas de vistas y engagement por publicación"><line className="performance-grid" x1={left} x2={width-right} y1={height-bottom} y2={height-bottom}/>{[0,.25,.5,.75,1].map((part) => <g key={part}><line className="performance-grid" x1={left} x2={width-right} y1={top+part*(height-top-bottom)} y2={top+part*(height-top-bottom)}/><text className="performance-axis left" x={left-10} y={top+(1-part)*(height-top-bottom)+4}>{number.format(Math.round(maxViews*part))}</text><text className="performance-axis right" x={width-right+10} y={top+(1-part)*(height-top-bottom)+4}>{(maxRate*part).toFixed(1)}%</text></g>)}<path className="relative-path" d={line("views", yViews)}/><path className="engagement-path" d={line("rate", yRate)}/>{data.map((point, index) => <circle key={point.item.url} className="relative-dot" cx={x(index)} cy={yViews(point.views)} r="3"><title>{`${point.item.title}: ${number.format(point.views)} vistas`}</title></circle>)}{data.map((point, index) => <circle key={`e-${point.item.url}`} className="engagement-dot" cx={x(index)} cy={yRate(point.rate)} r="3"><title>{`${point.item.title}: ${point.rate.toFixed(2)}%`}</title></circle>)}<text className="performance-axis date start" x={left} y={height-13}>{formatDate(first)}</text><text className="performance-axis date end" x={width-right} y={height-13}>{formatDate(last)}</text></svg></div>;
}
