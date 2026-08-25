"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFlores } from "./use-flores";
import type { RegistroFlores } from "./use-flores";

const moneda = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 2,
});
const numero = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function FloresDashboard() {
  const [periodo, setPeriodo] = useState("max");
  const { historial, cargando, error } = useFlores(periodo);
  const ordenado = useMemo(
    () => [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [historial],
  );
  const resumen = useMemo(() => {
    const precios = historial.map((item) => item.valorReferencia);
    const promedio = precios.length ? precios.reduce((total, precio) => total + precio, 0) / precios.length : 0;
    const actual = ordenado[0]?.valorReferencia ?? 0;
    const anterior = ordenado[1]?.valorReferencia ?? actual;
    const variacion = anterior ? ((actual - anterior) / anterior) * 100 : 0;
    return {
      cantidad: historial.length,
      promedio,
      actual,
      variacion,
      minimo: precios.length ? Math.min(...precios) : 0,
      maximo: precios.length ? Math.max(...precios) : 0,
    };
  }, [historial, ordenado]);

  return (
    <main className="flores-page">
      <header className="flores-header">
        <a className="flores-logo" href="/">☁ nube</a>
        <a href="/plants">Botanical tracking →</a>
      </header>

      <section className="flores-intro">
        <div>
          <p className="flores-kicker">Flower market</p>
          <h1>Flowers, prices,<br/><em>and candles.</em></h1>
          <p>Track the FLORES market price and daily candles reported by the data service.</p>
        </div>
        <div className="flores-filtros">
          <label>Time range<select value={periodo} onChange={(event) => setPeriodo(event.target.value)}><option value="7d">7 days</option><option value="1mo">1 month</option><option value="2mo">2 months</option><option value="6mo">6 months</option><option value="1y">1 year</option><option value="max">All time</option></select></label>
        </div>
      </section>

      {cargando && <section className="flores-status" aria-live="polite">Loading flower market data…</section>}
      {error && <section className="flores-status flores-error" role="alert"><strong>We could not load the data.</strong><span>{error}</span></section>}
      {!cargando && !error && <>
        <section className="flores-metricas" aria-label="Flower market summary">
          <article><span>Daily candles</span><strong>{numero.format(resumen.cantidad)}</strong><small>records in this range</small></article>
          <article><span>Latest market price</span><strong>{moneda.format(resumen.actual)}</strong><small>{resumen.variacion >= 0 ? "+" : ""}{resumen.variacion.toFixed(2)}% from the previous candle</small></article>
          <article><span>Average price</span><strong>{moneda.format(resumen.promedio)}</strong><small>during this range</small></article>
          <article><span>Price range</span><strong>{moneda.format(resumen.minimo)}</strong><small>high {moneda.format(resumen.maximo)}</small></article>
        </section>
        <section className="flores-historial">
          <div><p className="flores-kicker">Price history</p><h2>Market timeline</h2></div>
          {ordenado.length ? <PriceChart historial={historial} /> : <div className="flores-vacio">No records match the selected range.</div>}
        </section>
      </>}
    </main>
  );
}

function PriceChart({ historial }: { historial: RegistroFlores[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(900);
  const datos = useMemo(() => [...historial].sort((a, b) => a.fecha.localeCompare(b.fecha)), [historial]);
  const [activo, setActivo] = useState(datos.length - 1);
  useEffect(() => { const elemento = contenedor.current; if (!elemento) return; const observer = new ResizeObserver(([entry]) => setAncho(Math.max(320, entry.contentRect.width))); observer.observe(elemento); return () => observer.disconnect(); }, []);
  useEffect(() => setActivo(datos.length - 1), [datos.length]);
  const alto = ancho < 600 ? 350 : 430, izquierda = ancho < 600 ? 62 : 82, derecha = 18, arriba = 25, abajo = 58;
  const precios = datos.map((item) => item.valorReferencia), minimoReal = Math.min(...precios), maximoReal = Math.max(...precios), margen = Math.max((maximoReal - minimoReal) * .08, 1), minimo = minimoReal - margen, maximo = maximoReal + margen;
  const tiempos = datos.map((item) => new Date(`${item.fecha}T00:00:00Z`).getTime()), tiempoMinimo = Math.min(...tiempos), tiempoMaximo = Math.max(...tiempos);
  const x = (index: number) => izquierda + ((tiempos[index] - tiempoMinimo) / Math.max(tiempoMaximo - tiempoMinimo, 1)) * (ancho - izquierda - derecha);
  const y = (valor: number) => arriba + (1 - (valor - minimo) / Math.max(maximo - minimo, 1)) * (alto - arriba - abajo);
  const linea = datos.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item.valorReferencia).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(datos.length - 1)},${alto - abajo} L${x(0)},${alto - abajo} Z`;
  const ticksY = Array.from({ length: 5 }, (_, index) => minimo + ((maximo - minimo) * index) / 4);
  const ticksX = Array.from(new Set([0, Math.round((datos.length - 1) / 3), Math.round((datos.length - 1) * 2 / 3), datos.length - 1]));
  const indiceActivo = Math.max(0, Math.min(activo, datos.length - 1)), seleccionado = datos[indiceActivo];
  function mover(event: React.PointerEvent<SVGRectElement>) { const limites = event.currentTarget.getBoundingClientRect(); const posicion = ((event.clientX - limites.left) / limites.width) * ancho; let cercano = 0, distancia = Infinity; datos.forEach((_, index) => { const siguiente = Math.abs(x(index) - posicion); if (siguiente < distancia) { distancia = siguiente; cercano = index; } }); setActivo(cercano); }
  return <div className="flores-grafica"><div className="flores-grafica-valor" aria-live="polite"><strong>{moneda.format(seleccionado.valorReferencia)}</strong><span>{fecha.format(new Date(`${seleccionado.fecha}T12:00:00`))}</span>{seleccionado.fuente === "csv" && <span className="flores-fuente">CSV garden record{seleccionado.floresRecibidas ? ` · ${seleccionado.floresRecibidas} flowers received` : ""}</span>}</div><div ref={contenedor} className="flores-grafica-wrap"><svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`FLORES closing-price history across ${datos.length} candles`}><title>FLORES closing-price history</title><defs><linearGradient id="flores-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5f8f" stopOpacity=".34"/><stop offset="1" stopColor="#8b5f8f" stopOpacity=".03"/></linearGradient></defs>{ticksY.map((tick) => <g key={tick}><line className="flores-grid" x1={izquierda} x2={ancho-derecha} y1={y(tick)} y2={y(tick)}/><text className="flores-axis flores-axis-y" x={izquierda-10} y={y(tick)+4}>{numero.format(tick)}</text></g>)}<text className="flores-axis-title" x={izquierda} y={14}>Closing price (UYU)</text><path className="flores-area" d={area}/><path className="flores-linea" d={linea}/>{datos.map((item, index) => item.fuente === "csv" ? <circle key={`csv-${item.fecha}`} className="flores-csv-punto" cx={x(index)} cy={y(item.valorReferencia)} r="4"/> : null)}{ticksX.map((index) => <text key={index} className="flores-axis flores-axis-x" x={x(index)} y={alto-18}>{new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(new Date(`${datos[index].fecha}T12:00:00`))}</text>)}<line className="flores-guia" x1={x(indiceActivo)} x2={x(indiceActivo)} y1={arriba} y2={alto-abajo}/><circle className="flores-punto" cx={x(indiceActivo)} cy={y(seleccionado.valorReferencia)} r="6"/><rect className="flores-hit" x={izquierda} y={arriba} width={ancho-izquierda-derecha} height={alto-arriba-abajo} onPointerMove={mover} onPointerLeave={() => setActivo(datos.length-1)}/></svg></div></div>;
}
