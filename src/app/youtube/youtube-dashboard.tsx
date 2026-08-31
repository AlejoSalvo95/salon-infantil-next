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
  return <section className={`youtube-results ${accent}`}><div className="youtube-results-heading"><div><p className="youtube-kicker">{items.length} publicaciones</p><h2>{title}</h2></div><span>{number.format(total(items, "viewCount"))} vistas</span></div>{items.length ? <div className="youtube-table-wrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Vistas</th><th>Likes</th><th>Comentarios</th><th>Duración</th><th></th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.url}-${index}`}><td>{formatDate(item.uploadDate)}</td><td><strong>{item.title}</strong></td><td>{item.viewCount === null ? "—" : number.format(item.viewCount)}</td><td>{item.likeCount === null ? "—" : number.format(item.likeCount)}</td><td>{item.commentCount === null ? "—" : number.format(item.commentCount)}</td><td>{formatDuration(item.duration)}</td><td><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.title} en YouTube`}>↗</a></td></tr>)}</tbody></table></div> : <p className="youtube-no-results">No se encontraron publicaciones públicas en esta sección.</p>}</section>;
}
