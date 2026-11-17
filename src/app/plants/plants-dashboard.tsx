"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlantEvent, PlantMeasurement } from "./page";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";

type Props = { measurements: PlantMeasurement[]; waterEvents: PlantEvent[]; nutrientEvents: PlantEvent[] };
const dateFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function timestamp(date: string) { return new Date(`${date}T12:00:00`).getTime(); }
function uniqueEventDates(events: PlantEvent[]) { return [...new Set(events.map((event) => event.date))]; }


// Treat flows between observations as included in the ending balance.
// Chain returns instead of subtracting lifetime contributions from the denominator.
function contributionAdjustedDrawdown(measurements: PlantMeasurement[], water: PlantEvent[]) {
  if (!measurements.length) return null;
  const ordered = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered[0].totalHeight <= 0) return null;
  const flows = [...water].sort((a, b) => a.date.localeCompare(b.date));
  let flowIndex = 0;
  while (flowIndex < flows.length && flows[flowIndex].date <= ordered[0].date) flowIndex++;
  let index = 100, peak = 100, peakDate = ordered[0].date;
  for (let i = 1; i < ordered.length; i++) {
    let contributions = 0;
    while (flowIndex < flows.length && flows[flowIndex].date <= ordered[i].date) {
      contributions += flows[flowIndex++].value;
    }
    const previous = ordered[i - 1].totalHeight;
    const adjustedBalance = ordered[i].totalHeight - contributions;
    if (previous <= 0 || adjustedBalance < 0) return null;
    index *= adjustedBalance / previous;
    if (!Number.isFinite(index)) return null;
    if (index > peak) { peak = index; peakDate = ordered[i].date; }
  }
  return { percent: Math.max(0, (1 - index / peak) * 100), peakDate };
}

export function PlantsDashboard({ measurements, waterEvents, nutrientEvents }: Props) {
  const plantId = measurements[0]?.plantId ?? "";
  const selected = useMemo(() => measurements.filter((item) => item.plantId === plantId), [measurements, plantId]);
  const water = useMemo(() => waterEvents.filter((item) => item.plantId === plantId), [waterEvents, plantId]);
  const nutrients = useMemo(() => nutrientEvents.filter((item) => item.plantId === plantId), [nutrientEvents, plantId]);
  const latest = selected.at(-1);
  const drawdown = contributionAdjustedDrawdown(selected, water);
  const dropFromPeak = drawdown?.percent ?? 0;
  const netContributions = water.filter((event) => latest && event.date <= latest.date).reduce((total, event) => total + event.value, 0);
  const simpleReturn = latest && netContributions > 0 ? (latest.totalHeight - netContributions) / netContributions * 100 : null;
  const formatReturn = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${percentage.format(value)}%`;
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const change = selected.slice(1).reduce((total, item, index) => wateredDates.has(item.date) ? total : total + item.totalHeight - selected[index].totalHeight, 0);
  const monthlyGrowth = new Map<string, number>();
  selected.slice(1).forEach((item, index) => {
    if (wateredDates.has(item.date)) return;
    const month = item.date.slice(0, 7);
    monthlyGrowth.set(month, (monthlyGrowth.get(month) ?? 0) + item.totalHeight - selected[index].totalHeight);
  });
  const averageMonthlyGrowth = monthlyGrowth.size
    ? [...monthlyGrowth.values()].reduce((total, value) => total + value, 0) / monthlyGrowth.size
    : 0;

  return <main className="plants-page"><header className="plants-header"><a className="plants-logo" href="/">☁ nube</a><PrivateAreaNav current="plants"/></header><section className="plants-intro"><div><p className="plants-kicker">Live garden data</p><h1>Growth<br/><em>journal.</em></h1></div></section>{selected.length ? <><section className="plant-metrics" aria-label="Plant summary"><article><span>Latest total height</span><strong>{compact.format(latest!.totalHeight)}</strong><small>recorded on {dateFormat.format(new Date(`${latest!.date}T12:00`))}</small></article>
{dropFromPeak > 3 && <article className="plant-metric-loss"><span>Drop from peak</span><strong>{percentage.format(dropFromPeak)}%</strong><small>watering-adjusted · peak on {dateFormat.format(new Date(`${drawdown!.peakDate}T12:00`))}</small></article>}
<article><span>Simple return</span><strong>{formatReturn(simpleReturn)}</strong><small>total gain over net contributions</small></article>
<article><span>Cumulative change</span><strong>{change >= 0 ? "+" : ""}{compact.format(change)}</strong><small>on days without watering</small></article>
<article><span>Average monthly growth</span><strong>{averageMonthlyGrowth >= 0 ? "+" : ""}{compact.format(averageMonthlyGrowth)}</strong><small>average across {monthlyGrowth.size} observed months</small></article>
<article><span>Observations</span><strong>{selected.length}</strong><small>{uniqueEventDates(water.filter((event) => event.value > 0)).length} watering days · {uniqueEventDates(nutrients).length} with nutrients</small></article></section><ChartExplorer key={plantId} measurements={selected} water={water} nutrients={nutrients}/></> : <section className="plant-empty"><span>☘</span><h2>No measurements yet</h2><p>Imported Supabase measurements will appear here.</p></section>}</main>;
}

type ChartRange = { start: string; end: string };
type ChangeChartProps = { measurements: PlantMeasurement[]; water: PlantEvent[]; range: ChartRange };
const precise = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
function inRange(date: string, range: ChartRange) { return date >= range.start && date <= range.end; }
function axisDate(date: string, min: number, max: number) {
  return new Intl.DateTimeFormat("en-US", max - min < 100 * 86400000 ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" }).format(new Date(date + "T12:00:00"));
}

function ChartExplorer({ measurements, water, nutrients }: { measurements: PlantMeasurement[]; water: PlantEvent[]; nutrients: PlantEvent[] }) {
  const last = measurements.length - 1;
  const [window, setChartWindow] = useState<[number, number]>(() => {
    const cutoff = timestamp(measurements[last].date) - 90 * 86400000;
    const start = Math.max(0, measurements.findIndex(item => timestamp(item.date) >= cutoff));
    return [start, last];
  });
  const [activePreset, setActivePreset] = useState<number | null | undefined>(90);
  function setWindow(next: [number, number]) {
    setChartWindow(next);
    setActivePreset(undefined);
  }
  const start = Math.min(window[0], last), end = Math.min(window[1], last);
  const range = { start: measurements[start].date, end: measurements[end].date };
  const visible = measurements.slice(start, end + 1);
  function preset(days: number | null) {
    const cutoff = timestamp(measurements[last].date) - (days ?? 0) * 86400000;
    setWindow([days === null ? 0 : Math.max(0, measurements.findIndex(item => timestamp(item.date) >= cutoff)), last]);
    setActivePreset(days);
  }
  function zoom(factor: number) {
    const count = Math.min(measurements.length, Math.max(1, Math.round(visible.length * factor)));
    const nextStart = Math.max(0, Math.min(last - count + 1, Math.round((start + end - count + 1) / 2)));
    setWindow([nextStart, nextStart + count - 1]);
  }
  function pan(direction: number) {
    const offset = direction * Math.max(1, Math.round(visible.length / 2));
    const nextStart = Math.max(0, Math.min(last - (end - start), start + offset));
    setWindow([nextStart, nextStart + end - start]);
  }
  function chooseDate(value: string, edge: "start" | "end") {
    if (!value) return;
    if (edge === "start") {
      const index = measurements.findIndex(item => item.date >= value);
      setWindow([Math.min(end, index < 0 ? last : index), end]);
    } else {
      let index = last;
      while (index > 0 && measurements[index].date > value) index--;
      setWindow([start, Math.max(start, index)]);
    }
  }
  return <>
    <section className="chart-controls" aria-label="Chart interval controls">
      <div className="chart-heading"><div><p className="plants-kicker">Explore your data</p><h2>Chart interval</h2></div><button type="button" onClick={() => preset(null)} disabled={start === 0 && end === last}>Reset view</button></div>
      <div className="chart-control-row" aria-label="Quick intervals">{([30, 90, 180, 365, null] as const).map((days, index) => <button type="button" key={String(days)} aria-pressed={activePreset === days} onClick={() => preset(days)}>{["1M", "3M", "6M", "1Y", "All time"][index]}</button>)}<span>{activePreset === undefined ? "Custom interval" : "Intervals end at the latest observation."}</span></div>
      <div className="chart-control-row"><label>From<input type="date" min={measurements[0].date} max={range.end} value={range.start} onChange={event => chooseDate(event.target.value, "start")}/></label><label>To<input type="date" min={range.start} max={measurements[last].date} value={range.end} onChange={event => chooseDate(event.target.value, "end")}/></label><button type="button" onClick={() => zoom(.5)} disabled={start === end}>Zoom in +</button><button type="button" onClick={() => zoom(2)} disabled={start === 0 && end === last}>Zoom out −</button><button type="button" onClick={() => pan(-1)} disabled={start === 0}>← Earlier</button><button type="button" onClick={() => pan(1)} disabled={end === last}>Later →</button></div>
      <div className="chart-range-sliders"><label>Start of interval<input type="range" min={0} max={last} value={start} disabled={!last} onChange={event => setWindow([Math.min(Number(event.target.value), end), end])}/></label><label>End of interval<input type="range" min={0} max={last} value={end} disabled={!last} onChange={event => setWindow([start, Math.max(start, Number(event.target.value))])}/></label></div>
      <p role="status">{dateFormat.format(new Date(range.start + "T12:00:00"))} – {dateFormat.format(new Date(range.end + "T12:00:00"))} · {visible.length} observations</p>
      <p className="chart-note">Controls apply to all charts. Dates snap to available observations. Summary cards stay all-time; cumulative values keep their full history. Monthly bars include only changes within this interval, so boundary months may be partial.</p>
    </section>
    <div key={range.start + range.end}><GrowthChart measurements={visible} water={water} nutrients={nutrients.filter(item => inRange(item.date, range))}/><CumulativeChangeChart measurements={measurements} water={water} range={range}/><NaturalGrowthChart measurements={measurements} water={water} range={range}/><MonthlyGrowthCharts measurements={measurements} water={water} range={range}/></div>
  </>;
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
  const x = (value: number) => left + (maxX === minX ? .5 : (value - minX) / (maxX - minX)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minY) / Math.max(maxY - minY, 1)) * (height - top - bottom);
  const line = measurements.map((item, index) => `${index ? "L" : "M"}${x(timestamp(item.date)).toFixed(1)},${y(item.totalHeight).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxX)},${height - bottom} L${x(minX)},${height - bottom} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const xTickIndexes = Array.from(new Set([0, Math.round((measurements.length - 1) / 3), Math.round((measurements.length - 1) * 2 / 3), measurements.length - 1]));
  const nutrientDates = uniqueEventDates(nutrients);
  const active = hovered === null ? measurements.at(-1)! : measurements[hovered];
  const activeWater = waterByDate.get(active.date);

  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = left + ((event.clientX - bounds.left) / bounds.width) * (width - left - right); let nearest = 0, distance = Infinity; measurements.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }

  return <section className="growth"><div className="chart-heading"><div><p className="plants-kicker">Growth over time</p><h2>Total height</h2></div><div className="chart-legend"><span><i className="legend-line"/>Growth without watering</span><span><i className="legend-water"/>Watered segment</span><span><i className="legend-nutrient"/>Nutrients</span></div></div><div className="chart-value" aria-live="polite"><strong>{precise.format(active.totalHeight)} <small>height</small></strong>{activeWater !== undefined && <strong className="water-value">{precise.format(activeWater)} <small>water added</small></strong>}<span>{dateFormat.format(new Date(`${active.date}T12:00`))}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Total-height chart with blue segments across ${dailyWater.length} watering dates`}><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--mint)" stopOpacity=".8"/><stop offset="1" stopColor="var(--mint)" stopOpacity=".05"/></linearGradient></defs>{yTicks.map((tick) => <g key={tick}><line className="chart-grid" x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{compact.format(tick)}</text></g>)}<text className="axis-title height-title" x={left} y={14}>Total height</text><path className="chart-area" d={area}/><path className="chart-line" d={line}/>{measurements.slice(1).map((item, index) => waterByDate.has(item.date) ? <line key={item.date} className="water-height-segment" x1={x(timestamp(measurements[index].date))} y1={y(measurements[index].totalHeight)} x2={x(timestamp(item.date))} y2={y(item.totalHeight)}/> : null)}{dailyWater.map((item) => { const measurement = measurements.find((entry) => entry.date === item.date); return measurement ? <circle key={item.date} className="water-height-point" cx={x(timestamp(item.date))} cy={y(measurement.totalHeight)} r="4"/> : null})}{nutrientDates.map((date) => <path key={`n-${date}`} className="event-dot nutrient" d={`M${x(timestamp(date))},${height-bottom+27} l5,5 -5,5 -5,-5 Z`}/>)}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-12}>{axisDate(measurements[index].date, minX, maxX)}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className={activeWater === undefined ? "hover-dot" : "water-height-hover"} cx={x(timestamp(active.date))} cy={y(active.totalHeight)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">The full curve represents height. Blue segments end at measurements taken on watering days; hover to see the amount added.</p></section>;
}

function NaturalGrowthChart({ measurements, water, range }: ChangeChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const changes = measurements.slice(1).map((item, index) => ({ date: item.date, value: item.totalHeight - measurements[index].totalHeight })).filter((item) => !wateredDates.has(item.date) && inRange(item.date, range));
  if (!changes.length) return null;
  const height = width < 600 ? 340 : 410, left = width < 600 ? 48 : 70, right = 20, top = 24, bottom = 54;
  const times = changes.map((item) => timestamp(item.date)), minX = Math.min(...times), maxX = Math.max(...times);
  const maxAbs = Math.max(...changes.map((item) => Math.abs(item.value)), 1);
  const x = (value: number) => left + (maxX === minX ? .5 : (value - minX) / (maxX - minX)) * (width - left - right);
  const y = (value: number) => top + ((maxAbs - value) / (maxAbs * 2)) * (height - top - bottom);
  const zeroY = y(0), slot = (width - left - right) / Math.max(changes.length, 1), barWidth = Math.max(1.5, Math.min(10, slot * .72));
  const yTicks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const xTickIndexes = Array.from(new Set([0, Math.round((changes.length - 1) / 3), Math.round((changes.length - 1) * 2 / 3), changes.length - 1]));
  const active = hovered === null ? changes.at(-1)! : changes[hovered];
  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = left + ((event.clientX - bounds.left) / bounds.width) * (width - left - right); let nearest = 0, distance = Infinity; changes.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }
  return <section className="growth natural-growth"><div className="chart-heading"><div><p className="plants-kicker">Change between measurements</p><h2>Growth and decline</h2></div><div className="chart-legend"><span><i className="legend-positive"/>Growth</span><span><i className="legend-negative"/>Decline</span></div></div><div className="chart-value" aria-live="polite"><strong className={active.value >= 0 ? "positive-value" : "negative-value"}>{active.value >= 0 ? "+" : ""}{precise.format(active.value)} <small>change</small></strong><span>{dateFormat.format(new Date(`${active.date}T12:00`))}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Height change across ${changes.length} dates without watering events`}>{yTicks.map((tick) => <g key={tick}><line className={tick === 0 ? "zero-line" : "chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{tick > 0 ? "+" : ""}{compact.format(tick)}</text></g>)}{changes.map((item) => { const itemY = y(item.value); return <rect key={item.date} className={item.value >= 0 ? "change-bar positive" : "change-bar negative"} x={x(timestamp(item.date))-barWidth/2} y={Math.min(itemY,zeroY)} width={barWidth} height={Math.max(Math.abs(zeroY-itemY),1)}/>})}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-12}>{axisDate(changes[index].date, minX, maxX)}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className={active.value >= 0 ? "change-hover positive" : "change-hover negative"} cx={x(timestamp(active.date))} cy={y(active.value)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">Dates with recorded watering events are excluded. Each bar shows the difference from the immediately previous measurement.</p></section>;
}

function CumulativeChangeChart({ measurements, water, range }: ChangeChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => { const node = wrap.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width))); observer.observe(node); return () => observer.disconnect(); }, []);
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  let cumulative = 0;
  const points = measurements.map((item, index) => {
    if (index > 0 && !wateredDates.has(item.date)) cumulative += item.totalHeight - measurements[index - 1].totalHeight;
    return { date: item.date, value: cumulative, watered: wateredDates.has(item.date) };
  }).filter((item) => inRange(item.date, range));
  if (!points.length) return null;
  const height = width < 600 ? 340 : 410, left = width < 600 ? 48 : 70, right = 20, top = 24, bottom = 58;
  const times = points.map((item) => timestamp(item.date)), minX = Math.min(...times), maxX = Math.max(...times);
  const rawMin = Math.min(0, ...points.map((item) => item.value)), rawMax = Math.max(0, ...points.map((item) => item.value));
  const padding = Math.max((rawMax - rawMin) * .1, 1), minY = rawMin - padding, maxY = rawMax + padding;
  const x = (value: number) => left + (maxX === minX ? .5 : (value - minX) / (maxX - minX)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minY) / Math.max(maxY - minY, 1)) * (height - top - bottom);
  const line = points.map((item, index) => `${index ? "L" : "M"}${x(timestamp(item.date)).toFixed(1)},${y(item.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxX)},${y(0)} L${x(minX)},${y(0)} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const xTickIndexes = Array.from(new Set([0, Math.round((points.length - 1) / 3), Math.round((points.length - 1) * 2 / 3), points.length - 1]));
  const active = hovered === null ? points.at(-1)! : points[hovered];
  function move(event: React.PointerEvent<SVGRectElement>) { const bounds = event.currentTarget.getBoundingClientRect(); const cursor = left + ((event.clientX - bounds.left) / bounds.width) * (width - left - right); let nearest = 0, distance = Infinity; points.forEach((item, index) => { const next = Math.abs(x(timestamp(item.date)) - cursor); if (next < distance) { distance = next; nearest = index; } }); setHovered(nearest); }
  return <section className="growth cumulative-growth"><div className="chart-heading"><div><p className="plants-kicker">On days without watering</p><h2>Cumulative change</h2></div><div className="chart-legend"><span><i className="legend-cumulative"/>Cumulative change</span><span><i className="legend-water-point"/>Watering day</span></div></div><div className="chart-value" aria-live="polite"><strong className={active.value >= 0 ? "positive-value" : "negative-value"}>{active.value >= 0 ? "+" : ""}{precise.format(active.value)} <small>cumulative change</small></strong><span>{dateFormat.format(new Date(`${active.date}T12:00`))}{active.watered ? " · watering day (unchanged)" : ""}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily cumulative height change across ${points.length} observations, excluding watering days`}><defs><linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#528166" stopOpacity=".26"/><stop offset="1" stopColor="#528166" stopOpacity=".02"/></linearGradient></defs>{yTicks.map((tick) => <g key={tick}><line className={Math.abs(tick) < .0001 ? "zero-line" : "chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{tick > 0 ? "+" : ""}{compact.format(tick)}</text></g>)}<line className="zero-line" x1={left} x2={width-right} y1={y(0)} y2={y(0)}/><path className="cumulative-area" d={area}/><path className="cumulative-line" d={line}/>{points.filter((item) => item.watered).map((item) => <circle key={item.date} className="cumulative-water-point" cx={x(timestamp(item.date))} cy={y(item.value)} r="3.5"/>)}{xTickIndexes.map((index) => <text key={index} className="chart-axis x" x={x(times[index])} y={height-14}>{axisDate(points[index].date, minX, maxX)}</text>)}<line className="hover-guide" x1={x(timestamp(active.date))} x2={x(timestamp(active.date))} y1={top} y2={height-bottom}/><circle className="cumulative-hover" cx={x(timestamp(active.date))} cy={y(active.value)} r="6"/><rect className="chart-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setHovered(null)}/></svg></div><p className="chart-note">Each point shows the running total on that date. Changes measured on watering days are excluded, so the line stays flat for those observations.</p></section>;
}

type MonthlyValue = { month: string; value: number };

function MonthlyGrowthCharts({ measurements, water, range }: ChangeChartProps) {
  const wateredDates = new Set(water.filter((event) => event.value > 0).map((event) => event.date));
  const monthly = new Map<string, { growth: number; baseline: number }>();
  measurements.slice(1).forEach((item, index) => {
    if (wateredDates.has(item.date) || !inRange(item.date, range)) return;
    const month = item.date.slice(0, 7), previous = measurements[index];
    const current = monthly.get(month) ?? { growth: 0, baseline: previous.totalHeight };
    current.growth += item.totalHeight - previous.totalHeight;
    monthly.set(month, current);
  });
  const absolute = [...monthly].map(([month, item]) => ({ month, value: item.growth }));
  const percentage = [...monthly].map(([month, item]) => ({ month, value: item.baseline === 0 ? 0 : item.growth / Math.abs(item.baseline) * 100 }));
  if (!absolute.length) return null;
  return <section className="monthly-section"><MonthlyBarChart title="Monthly growth" kicker="Accumulated without watering" data={absolute} valueLabel="change" formatter={(value) => `${value >= 0 ? "+" : ""}${compact.format(value)}`} note="Adds each month's height changes, excluding dates with added water."/><MonthlyBarChart title="Percentage growth" kicker="Month-over-month comparison" data={percentage} valueLabel="monthly change" formatter={(value) => `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`} note="Shows monthly change without watering as a percentage of the height immediately before the first included change in that month."/></section>;
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
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (month: string) => { const [year, number] = month.split("-").map(Number); return `${monthNames[number-1]} ${year}`; };
  return <article className="growth monthly-chart"><div className="chart-heading"><div><p className="plants-kicker">{kicker}</p><h2>{title}</h2></div></div><div className="chart-value" aria-live="polite"><strong className={active.value >= 0 ? "positive-value" : "negative-value"}>{formatter(active.value)} <small>{valueLabel}</small></strong><span>{monthLabel(active.month)}</span></div><div className="chart-wrap" ref={wrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} across ${data.length} months`}><line className="zero-line" x1={left} x2={width-right} y1={zeroY} y2={zeroY}/>{[-maxAbs,-maxAbs/2,0,maxAbs/2,maxAbs].map((tick) => <g key={tick}><line className={tick === 0 ? "zero-line" : "chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="chart-axis y" x={left-10} y={y(tick)+4}>{formatter(tick)}</text></g>)}{data.map((item,index) => { const itemY=y(item.value); return <g key={item.month} onPointerEnter={() => setHovered(index)}><rect className={item.value >= 0 ? "monthly-hit positive" : "monthly-hit negative"} x={x(index)-Math.max(barWidth,24)/2} y={top} width={Math.max(barWidth,24)} height={height-top-bottom}/><rect className={item.value >= 0 ? "change-bar positive" : "change-bar negative"} x={x(index)-barWidth/2} y={Math.min(itemY,zeroY)} width={barWidth} height={Math.max(Math.abs(zeroY-itemY),1)}/>{(index%labelEvery===0||index===data.length-1)&&<text className="chart-axis x" x={x(index)} y={height-14}>{monthLabel(item.month)}</text>}</g>})}<line className="hover-guide" x1={x(hovered)} x2={x(hovered)} y1={top} y2={height-bottom}/></svg></div><p className="chart-note">{note}</p></article>;
}
