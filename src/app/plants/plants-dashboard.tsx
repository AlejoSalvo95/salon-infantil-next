"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlantEvent, PlantMeasurement } from "./page";

type Props = { measurements: PlantMeasurement[]; waterEvents: PlantEvent[]; nutrientEvents: PlantEvent[] };
const dateFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function timestamp(date: string) { return new Date(`${date}T12:00:00`).getTime(); }
function uniqueEventDates(events: PlantEvent[]) { return [...new Set(events.map((event) => event.date))]; }

export function PlantsDashboard({ measurements, waterEvents, nutrientEvents }: Props) {
  const plantId = measurements[0]?.plantId ?? "";
  const selected = useMemo(() => measurements.filter((item) => item.plantId === plantId), [measurements, plantId]);
  const water = useMemo(() => waterEvents.filter((item) => item.plantId === plantId), [waterEvents, plantId]);
  const nutrients = useMemo(() => nutrientEvents.filter((item) => item.plantId === plantId), [nutrientEvents, plantId]);
  const latest = selected.at(-1);
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const change = selected.slice(1).reduce((total, item, index) => wateredDates.has(item.date) ? total : total + item.totalHeight - selected[index].totalHeight, 0);

  return <main className="plants-page"><header className="plants-header"><a className="plants-logo" href="/">☁ nube</a><div><span>Botanical tracking</span><form action="/api/plants/logout" method="post"><button type="submit">Sign out</button></form></div></header><section className="plants-intro"><div><p className="plants-kicker">Live garden data</p><h1>Growth<br/><em>journal.</em></h1></div></section>{selected.length ? <><section className="plant-metrics" aria-label="Plant summary"><article><span>Latest total height</span><strong>{compact.format(latest!.totalHeight)}</strong><small>recorded on {dateFormat.format(new Date(`${latest!.date}T12:00`))}</small></article><article><span>Cumulative change</span><strong>{change >= 0 ? "+" : ""}{compact.format(change)}</strong><small>on days without watering</small></article><article><span>Observations</span><strong>{selected.length}</strong><small>{uniqueEventDates(water.filter((event) => event.value > 0)).length} watering days · {uniqueEventDates(nutrients).length} with nutrients</small></article></section><GrowthChart measurements={selected} water={water} nutrients={nutrients}/><NaturalGrowthChart measurements={selected} water={water}/><MonthlyGrowthCharts measurements={selected} water={water}/></> : <section className="plant-empty"><span>☘</span><h2>No measurements yet</h2><p>Imported Supabase measurements will appear here.</p></section>}</main>;
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
  const waterByDate = new Map<string, number>();
  water.filter((event) => event.value > 0).forEach((event) => waterByDate.set(event.date, (waterByDate.get(event.date) ?? 0) + event.value));
  const dailyWater = [...waterByDate].map(([date, value]) => ({ date, value })).filter((item) => timestamp(item.date) >= minX && timestamp(item.date) <= maxX).sort((a, b) => a.date.localeCompare(b.date));
  const x = (value: number) => left + ((value - minX) / Math.max(maxX - minX, 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minY) / Math.max(maxY - minY, 1)) * (height - top - bottom);
  const line = measurements.map((item, index) => `${index ? "L" : "M"}${x(timestamp(item.date)).toFixed(1)},${y(item.totalHeight).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxX)},${height - bottom} L${x(minX)},${height - bottom} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const xTickIndexes = Array.from(new Set([0, Math.round((measurements.length - 1) / 3), Math.round((measurements.length - 1) * 2 / 3), measurements.length - 1]));
  const nutrientDates = uniqueEventDates(nutrients);
  const active = hovered === null ? measurements.at(-1)! : measurements[hovered];
  const activeWater = waterByDate.get(active.date);

  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = ((event.clientX - bounds.left) / bounds.width) * width; let nearest = 0, distance = Infinity; measurements.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }

  return <section className="growth"><div className="chart-heading"><div><p className="plants-kicker">Growth over time</p><h2>Total height</h2></div><div className="chart-legend"><span><i className="legend-line"/>Growth without watering</span><span><i className="legend-water"/>Watered segment</span><span><i className="legend-nutrient"/>Nutrients</span></div></div><div className="chart-value" aria-live="polite"><strong>{compact.format(active.totalHeight)} <small>height</small></strong>{activeWater !== undefined && <strong className="water-value">{compact.format(activeWater)} <small>water added</small></strong>}<span>{dateFormat.format(new Date(`${active.date}T12:00`))}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Total-height chart with blue segments across ${dailyWater.length} watering dates`}><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--mint)" stopOpacity=".8"/><stop offset="1" stopColor="var(--mint)" stopOpacity=".05"/></linearGradient></defs>{yTicks.map((tick) => <g key={tick}><line className="chart-grid" x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{compact.format(tick)}</text></g>)}<text className="axis-title height-title" x={left} y={14}>Total height</text><path className="chart-area" d={area}/><path className="chart-line" d={line}/>{measurements.slice(1).map((item, index) => waterByDate.has(item.date) ? <line key={item.date} className="water-height-segment" x1={x(timestamp(measurements[index].date))} y1={y(measurements[index].totalHeight)} x2={x(timestamp(item.date))} y2={y(item.totalHeight)}/> : null)}{dailyWater.map((item) => { const measurement = measurements.find((entry) => entry.date === item.date); return measurement ? <circle key={item.date} className="water-height-point" cx={x(timestamp(item.date))} cy={y(measurement.totalHeight)} r="4"/> : null})}{nutrientDates.map((date) => <path key={`n-${date}`} className="event-dot nutrient" d={`M${x(timestamp(date))},${height-bottom+27} l5,5 -5,5 -5,-5 Z`}/>)}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-12}>{new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(`${measurements[index].date}T12:00`))}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className={activeWater === undefined ? "hover-dot" : "water-height-hover"} cx={x(timestamp(active.date))} cy={y(active.totalHeight)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">The full curve represents height. Blue segments end at measurements taken on watering days; hover to see the amount added.</p></section>;
}

function NaturalGrowthChart({ measurements, water }: { measurements: PlantMeasurement[]; water: PlantEvent[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const changes = measurements.slice(1).map((item, index) => ({ date: item.date, value: item.totalHeight - measurements[index].totalHeight })).filter((item) => !wateredDates.has(item.date));
  if (!changes.length) return null;
  const height = width < 600 ? 340 : 410, left = width < 600 ? 48 : 70, right = 20, top = 24, bottom = 54;
  const times = changes.map((item) => timestamp(item.date)), minX = Math.min(...times), maxX = Math.max(...times);
  const maxAbs = Math.max(...changes.map((item) => Math.abs(item.value)), 1);
  const x = (value: number) => left + ((value - minX) / Math.max(maxX - minX, 1)) * (width - left - right);
  const y = (value: number) => top + ((maxAbs - value) / (maxAbs * 2)) * (height - top - bottom);
  const zeroY = y(0), slot = (width - left - right) / Math.max(changes.length, 1), barWidth = Math.max(1.5, Math.min(10, slot * .72));
  const yTicks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const xTickIndexes = Array.from(new Set([0, Math.round((changes.length - 1) / 3), Math.round((changes.length - 1) * 2 / 3), changes.length - 1]));
  const active = hovered === null ? changes.at(-1)! : changes[hovered];
  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = ((event.clientX - bounds.left) / bounds.width) * width; let nearest = 0, distance = Infinity; changes.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }
  return <section className="growth natural-growth"><div className="chart-heading"><div><p className="plants-kicker">Change between measurements</p><h2>Growth and decline</h2></div><div className="chart-legend"><span><i className="legend-positive"/>Growth</span><span><i className="legend-negative"/>Decline</span></div></div><div className="chart-value" aria-live="polite"><strong className={active.value >= 0 ? "positive-value" : "negative-value"}>{active.value >= 0 ? "+" : ""}{compact.format(active.value)} <small>change</small></strong><span>{dateFormat.format(new Date(`${active.date}T12:00`))}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Height change across ${changes.length} dates without watering events`}>{yTicks.map((tick) => <g key={tick}><line className={tick === 0 ? "zero-line" : "chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{tick > 0 ? "+" : ""}{compact.format(tick)}</text></g>)}{changes.map((item) => { const itemY = y(item.value); return <rect key={item.date} className={item.value >= 0 ? "change-bar positive" : "change-bar negative"} x={x(timestamp(item.date))-barWidth/2} y={Math.min(itemY,zeroY)} width={barWidth} height={Math.max(Math.abs(zeroY-itemY),1)}/>})}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-12}>{new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(`${changes[index].date}T12:00`))}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className={active.value >= 0 ? "change-hover positive" : "change-hover negative"} cx={x(timestamp(active.date))} cy={y(active.value)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">Dates with recorded watering events are excluded. Each bar shows the difference from the immediately previous measurement.</p></section>;
}

type MonthlyValue = { month: string; value: number };

function MonthlyGrowthCharts({ measurements, water }: { measurements: PlantMeasurement[]; water: PlantEvent[] }) {
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const monthly = new Map<string, { growth: number; baseline: number }>();
  measurements.slice(1).forEach((item, index) => {
    if (wateredDates.has(item.date)) return;
    const month = item.date.slice(0, 7), previous = measurements[index];
    const current = monthly.get(month) ?? { growth: 0, baseline: previous.totalHeight };
    current.growth += item.totalHeight - previous.totalHeight;
    monthly.set(month, current);
  });
  const absolute = [...monthly].map(([month, item]) => ({ month, value: item.growth }));
  const percentage = [...monthly].map(([month, item]) => ({ month, value: item.baseline === 0 ? 0 : item.growth / Math.abs(item.baseline) * 100 }));
  if (!absolute.length) return null;
  return <section className="monthly-section"><MonthlyBarChart title="Monthly growth" kicker="Accumulated without watering" data={absolute} valueLabel="change" formatter={(value) => `${value >= 0 ? "+" : ""}${compact.format(value)}`} note="Adds each month's height changes, excluding dates with added water."/><MonthlyBarChart title="Percentage growth" kicker="Month-over-month comparison" data={percentage} valueLabel="monthly change" formatter={(value) => `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`} note="Shows monthly change without watering as a percentage of the height recorded at the start of that month."/></section>;
}

function MonthlyBarChart({ title, kicker, data, valueLabel, formatter, note }: { title: string; kicker: string; data: MonthlyValue[]; valueLabel: string; formatter: (value: number) => string; note: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState(data.length - 1);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  useEffect(() => setHovered(data.length - 1), [data.length]);
  const height = width < 600 ? 330 : 390, left = width < 600 ? 48 : 70, right = 20, top = 24, bottom = 58;
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1), zeroY = top + (height-top-bottom)/2;
  const y = (value: number) => top + ((maxAbs-value)/(maxAbs*2))*(height-top-bottom);
  const plotWidth = width-left-right, slot = plotWidth/Math.max(data.length,1), barWidth = Math.max(8, Math.min(42, slot*.58));
  const x = (index: number) => left + slot*(index+.5), labelEvery = width < 600 ? Math.ceil(data.length/5) : Math.ceil(data.length/9);
  const active = data[Math.max(0, Math.min(hovered, data.length-1))];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthLabel = (month: string) => { const [year, number] = month.split("-").map(Number); return `${monthNames[number-1]} ${year}`; };
  return <article className="growth monthly-chart"><div className="chart-heading"><div><p className="plants-kicker">{kicker}</p><h2>{title}</h2></div></div><div className="chart-value" aria-live="polite"><strong className={active.value >= 0 ? "positive-value" : "negative-value"}>{formatter(active.value)} <small>{valueLabel}</small></strong><span>{monthLabel(active.month)}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} across ${data.length} months`}><line className="zero-line" x1={left} x2={width-right} y1={zeroY} y2={zeroY}/>{[-maxAbs,-maxAbs/2,0,maxAbs/2,maxAbs].map((tick) => <g key={tick}><line className={tick === 0 ? "zero-line" : "chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{formatter(tick)}</text></g>)}{data.map((item,index) => { const itemY=y(item.value); return <g key={item.month} onPointerEnter={() => setHovered(index)}><rect className={item.value >= 0 ? "monthly-hit positive" : "monthly-hit negative"} x={x(index)-Math.max(barWidth,24)/2} y={top} width={Math.max(barWidth,24)} height={height-top-bottom}/><rect className={item.value >= 0 ? "change-bar positive" : "change-bar negative"} x={x(index)-barWidth/2} y={Math.min(itemY,zeroY)} width={barWidth} height={Math.max(Math.abs(zeroY-itemY),1)}/>{(index%labelEvery===0||index===data.length-1)&&<text className="chart-axis x" x={x(index)} y={height-14}>{monthLabel(item.month)}</text>}</g>})}<line className="hover-guide" x1={x(hovered)} x2={x(hovered)} y1={top} y2={height-bottom}/></svg></div><p className="chart-note">{note}</p></article>;
}
