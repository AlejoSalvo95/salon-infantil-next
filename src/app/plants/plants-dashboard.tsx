"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlantEvent, PlantMeasurement } from "./page";

type Props = { measurements: PlantMeasurement[]; waterEvents: PlantEvent[]; nutrientEvents: PlantEvent[] };
const dateFormat = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", year: "numeric" });
const compact = new Intl.NumberFormat("es-UY", { notation: "compact", maximumFractionDigits: 1 });

function timestamp(date: string) { return new Date(`${date}T12:00:00`).getTime(); }
function uniqueEventDates(events: PlantEvent[]) { return [...new Set(events.map((event) => event.date))]; }

export function PlantsDashboard({ measurements, waterEvents, nutrientEvents }: Props) {
  const plants = useMemo(() => [...new Set(measurements.map((item) => item.plantId))].sort(), [measurements]);
  const [plantId, setPlantId] = useState(plants[0] ?? "");
  const selected = useMemo(() => measurements.filter((item) => item.plantId === plantId), [measurements, plantId]);
  const water = useMemo(() => waterEvents.filter((item) => item.plantId === plantId), [waterEvents, plantId]);
  const nutrients = useMemo(() => nutrientEvents.filter((item) => item.plantId === plantId), [nutrientEvents, plantId]);
  const first = selected[0], latest = selected.at(-1);
  const change = first && latest ? latest.totalHeight - first.totalHeight : 0;

  return <main className="plants-page"><header className="plants-header"><a className="plants-logo" href="/">☁ nube</a><div><span>Seguimiento botánico</span><form action="/api/plants/logout" method="post"><button type="submit">Cerrar sesión</button></form></div></header><section className="plants-intro"><div><p className="plants-kicker">Datos desde Supabase</p><h1>Diario de<br/><em>crecimiento.</em></h1></div><div className="plant-picker"><label htmlFor="plant">Planta observada</label><select id="plant" value={plantId} onChange={(event) => setPlantId(event.target.value)}>{plants.map((plant) => <option key={plant}>{plant}</option>)}</select></div></section>{selected.length ? <><section className="plant-metrics" aria-label="Resumen"><article><span>Última altura total</span><strong>{compact.format(latest!.totalHeight)}</strong><small>registrada el {dateFormat.format(new Date(`${latest!.date}T12:00`))}</small></article><article><span>Cambio acumulado</span><strong>{change >= 0 ? "+" : ""}{compact.format(change)}</strong><small>desde la primera medición</small></article><article><span>Observaciones</span><strong>{selected.length}</strong><small>{uniqueEventDates(water).length} días de riego · {uniqueEventDates(nutrients).length} con nutrientes</small></article></section><GrowthChart measurements={selected} water={water} nutrients={nutrients}/></> : <section className="plant-empty"><span>☘</span><h2>Todavía no hay mediciones</h2><p>Cuando se importe información en Supabase aparecerá acá.</p></section>}</main>;
}

function GrowthChart({ measurements, water, nutrients }: { measurements: PlantMeasurement[]; water: PlantEvent[]; nutrients: PlantEvent[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  const height = width < 600 ? 360 : 440, left = width < 600 ? 46 : 70, right = 20, top = 30, bottom = 72;
  const times = measurements.map((item) => timestamp(item.date));
  const values = measurements.map((item) => item.totalHeight);
  const minX = Math.min(...times), maxX = Math.max(...times), rawMin = Math.min(...values), rawMax = Math.max(...values), padding = Math.max((rawMax - rawMin) * .08, 1), minY = Math.max(0, rawMin - padding), maxY = rawMax + padding;
  const x = (value: number) => left + ((value - minX) / Math.max(maxX - minX, 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minY) / Math.max(maxY - minY, 1)) * (height - top - bottom);
  const line = measurements.map((item, index) => `${index ? "L" : "M"}${x(timestamp(item.date)).toFixed(1)},${y(item.totalHeight).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxX)},${height - bottom} L${x(minX)},${height - bottom} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const xTickIndexes = Array.from(new Set([0, Math.round((measurements.length - 1) / 3), Math.round((measurements.length - 1) * 2 / 3), measurements.length - 1]));
  const waterDates = uniqueEventDates(water), nutrientDates = uniqueEventDates(nutrients);
  const active = hovered === null ? measurements.at(-1)! : measurements[hovered];

  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = ((event.clientX - bounds.left) / bounds.width) * width; let nearest = 0, distance = Infinity; measurements.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }

  return <section className="growth"><div className="chart-heading"><div><p className="plants-kicker">Evolución temporal</p><h2>Altura total</h2></div><div className="chart-legend"><span><i className="legend-line"/>Medición</span><span><i className="legend-water"/>Riego</span><span><i className="legend-nutrient"/>Nutrientes</span></div></div><div className="chart-value" aria-live="polite"><strong>{compact.format(active.totalHeight)}</strong><span>{dateFormat.format(new Date(`${active.date}T12:00`))}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfica de altura total con ${measurements.length} mediciones`}><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--mint)" stopOpacity=".8"/><stop offset="1" stopColor="var(--mint)" stopOpacity=".05"/></linearGradient></defs>{yTicks.map((tick) => <g key={tick}><line className="chart-grid" x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{compact.format(tick)}</text></g>)}<path className="chart-area" d={area}/><path className="chart-line" d={line}/>{waterDates.map((date) => <g key={`w-${date}`}><line className="event-line water" x1={x(timestamp(date))} x2={x(timestamp(date))} y1={height-bottom+8} y2={height-bottom+25}/><circle className="event-dot water" cx={x(timestamp(date))} cy={height-bottom+31} r="4"/></g>)}{nutrientDates.map((date) => <path key={`n-${date}`} className="event-dot nutrient" d={`M${x(timestamp(date))},${height-bottom+27} l5,5 -5,5 -5,-5 Z`}/>)}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-12}>{new Intl.DateTimeFormat("es-UY", { month: "short", year: "2-digit" }).format(new Date(`${measurements[index].date}T12:00`))}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className="hover-dot" cx={x(timestamp(active.date))} cy={y(active.totalHeight)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">Los marcadores inferiores indican días con eventos de cuidado. Pasá el cursor por la curva para explorar cada medición.</p></section>;
}
