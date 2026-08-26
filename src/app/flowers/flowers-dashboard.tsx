"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFlowers } from "./use-flowers";
import type { FlowerRecord } from "./use-flowers";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function FlowersDashboard() {
  const [range, setPeriodo] = useState("max");
  const { history, loading, error } = useFlowers(range);
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history],
  );
  const summary = useMemo(() => {
    const prices = history.map((item) => item.referencePrice);
    const average = prices.length ? prices.reduce((total, price) => total + price, 0) / prices.length : 0;
    const latest = sorted[0]?.referencePrice ?? 0;
    const previous = sorted[1]?.referencePrice ?? latest;
    const change = previous ? ((latest - previous) / previous) * 100 : 0;
    return {
      count: history.length,
      average,
      latest,
      change,
      minimum: prices.length ? Math.min(...prices) : 0,
      maximum: prices.length ? Math.max(...prices) : 0,
    };
  }, [history, sorted]);

  return (
    <main className="flowers-page">
      <header className="flowers-header">
        <a className="flowers-logo" href="/">☁ nube</a>
        <PrivateAreaNav current="flowers"/>
      </header>

      <section className="flowers-intro">
        <div>
          <p className="flowers-kicker">Flower market</p>
          <h1>Flowers, prices,<br/><em>and candles.</em></h1>
          <p>Track the FLORES market price and daily candles reported by the data service.</p>
        </div>
        <div className="flowers-filters">
          <label>Time range<select value={range} onChange={(event) => setPeriodo(event.target.value)}><option value="7d">7 days</option><option value="1mo">1 month</option><option value="2mo">2 months</option><option value="6mo">6 months</option><option value="1y">1 year</option><option value="max">All time</option></select></label>
        </div>
      </section>

      {loading && <section className="flowers-status" aria-live="polite">Loading flower market data…</section>}
      {error && <section className="flowers-status flowers-error" role="alert"><strong>We could not load the data.</strong><span>{error}</span></section>}
      {!loading && !error && <>
        <section className="flowers-metrics" aria-label="Flower market summary">
          <article><span>Daily candles</span><strong>{numberFormat.format(summary.count)}</strong><small>records in this range</small></article>
          <article><span>Latest market price</span><strong>{currency.format(summary.latest)}</strong><small>{summary.change >= 0 ? "+" : ""}{summary.change.toFixed(2)}% from the previous candle</small></article>
          <article><span>Average price</span><strong>{currency.format(summary.average)}</strong><small>during this range</small></article>
          <article><span>Price range</span><strong>{currency.format(summary.minimum)}</strong><small>high {currency.format(summary.maximum)}</small></article>
        </section>
        <section className="flowers-history">
          <div><p className="flowers-kicker">Price history</p><h2>Market timeline</h2></div>
          {sorted.length ? <PriceChart history={history} /> : <div className="flowers-empty">No records match the selected range.</div>}
        </section>
      </>}
    </main>
  );
}

function PriceChart({ history }: { history: FlowerRecord[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setAncho] = useState(900);
  const payload = useMemo(() => [...history].sort((a, b) => a.date.localeCompare(b.date)), [history]);
  const [active, setActivo] = useState(payload.length - 1);
  useEffect(() => { const elemento = container.current; if (!elemento) return; const observer = new ResizeObserver(([entry]) => setAncho(Math.max(320, entry.contentRect.width))); observer.observe(elemento); return () => observer.disconnect(); }, []);
  useEffect(() => setActivo(payload.length - 1), [payload.length]);
  const height = width < 600 ? 350 : 430, left = width < 600 ? 62 : 82, right = 18, top = 25, bottom = 58;
  const prices = payload.map((item) => item.referencePrice), minimumReal = Math.min(...prices), maximumReal = Math.max(...prices), padding = Math.max((maximumReal - minimumReal) * .08, 1), minimum = minimumReal - padding, maximum = maximumReal + padding;
  const times = payload.map((item) => new Date(`${item.date}T00:00:00Z`).getTime()), minimumTime = Math.min(...times), maximumTime = Math.max(...times);
  const x = (index: number) => left + ((times[index] - minimumTime) / Math.max(maximumTime - minimumTime, 1)) * (width - left - right);
  const y = (valor: number) => top + (1 - (valor - minimum) / Math.max(maximum - minimum, 1)) * (height - top - bottom);
  const line = payload.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item.referencePrice).toFixed(1)}`).join(" ");
  const area = `${line} L${x(payload.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`;
  const ticksY = Array.from({ length: 5 }, (_, index) => minimum + ((maximum - minimum) * index) / 4);
  const ticksX = Array.from(new Set([0, Math.round((payload.length - 1) / 3), Math.round((payload.length - 1) * 2 / 3), payload.length - 1]));
  const columnIndexActivo = Math.max(0, Math.min(active, payload.length - 1)), selected = payload[columnIndexActivo];
  function move(event: React.PointerEvent<SVGRectElement>) { const cutoffs = event.currentTarget.getBoundingClientRect(); const position = ((event.clientX - cutoffs.left) / cutoffs.width) * width; let nearest = 0, distance = Infinity; payload.forEach((_, index) => { const nextDistance = Math.abs(x(index) - position); if (nextDistance < distance) { distance = nextDistance; nearest = index; } }); setActivo(nearest); }
  return <div className="flowers-chart"><div className="flowers-chart-valor" aria-live="polite"><strong>{currency.format(selected.referencePrice)}</strong><span>{date.format(new Date(`${selected.date}T12:00:00`))}</span>{selected.source === "csv" && <span className="flowers-source">CSV garden record{selected.flowersReceived ? ` · ${selected.flowersReceived} flowers received` : ""}</span>}</div><div ref={container} className="flowers-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`FLORES closing-price history across ${payload.length} candles`}><title>FLORES closing-price history</title><defs><linearGradient id="flowers-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5f8f" stopOpacity=".34"/><stop offset="1" stopColor="#8b5f8f" stopOpacity=".03"/></linearGradient></defs>{ticksY.map((tick) => <g key={tick}><line className="flowers-grid" x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/><text className="flowers-axis flowers-axis-y" x={left-10} y={y(tick)+4}>{numberFormat.format(tick)}</text></g>)}<text className="flowers-axis-title" x={left} y={14}>Closing price (UYU)</text><path className="flowers-area" d={area}/><path className="flowers-line" d={line}/>{payload.map((item, index) => item.source === "csv" ? <circle key={`csv-${item.date}`} className="flowers-csv-punto" cx={x(index)} cy={y(item.referencePrice)} r="4"/> : null)}{ticksX.map((index) => <text key={index} className="flowers-axis flowers-axis-x" x={x(index)} y={height-18}>{new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(new Date(`${payload[index].date}T12:00:00`))}</text>)}<line className="flowers-guide" x1={x(columnIndexActivo)} x2={x(columnIndexActivo)} y1={top} y2={height-bottom}/><circle className="flowers-point" cx={x(columnIndexActivo)} cy={y(selected.referencePrice)} r="6"/><rect className="flowers-hit" x={left} y={top} width={width-left-right} height={height-top-bottom} onPointerMove={move} onPointerLeave={() => setActivo(payload.length-1)}/></svg></div></div>;
}
