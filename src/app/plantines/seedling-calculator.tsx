"use client";

import { useState, type FormEvent } from "react";

function currentMonths() {
  const now = new Date();
  const start = new Date(2024, 1, 1);
  return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
}

function futureValue(initial: number, contribution: number, annualRate: number, months: number) {
  const rate = annualRate / 100 / 12;
  if (rate === 0) return initial + contribution * months;
  return initial * Math.pow(1 + rate, months) + contribution * (Math.pow(1 + rate, months) - 1) / rate;
}

function estimateSeedlings(base: number, months: number) {
  const realTheoretical = futureValue(0, 2300, 7, months);
  const cashTheoretical = futureValue(0, 1000, 3, months);
  const final = realTheoretical > 0 ? base * (cashTheoretical / realTheoretical) : 0;
  return Math.floor(final / 1000) * 1000 + 3000;
}

export function SeedlingCalculator() {
  const [base, setBase] = useState("0");
  const [months, setMonths] = useState(currentMonths);
  const [result, setResult] = useState(() => estimateSeedlings(0, currentMonths()));

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMonths = currentMonths();
    const numericBase = Number.parseFloat(base) || 0;
    setMonths(nextMonths);
    setResult(estimateSeedlings(numericBase, nextMonths));
  }

  return <main className="seedlings-page"><header className="seedlings-header"><a className="seedlings-logo" href="/"><span>☁</span> nube</a><a href="/">Volver al inicio</a></header><section className="seedlings-shell"><div className="seedlings-copy"><p className="seedlings-kicker">Herramienta de estimación</p><h1>Calculá tus<br /><em>plantines.</em></h1><p>Ingresá la cantidad base para estimar cuántos plantines están disponibles según el ciclo actual.</p><div className="cycle"><span>Ciclo actual</span><strong>{months}</strong><small>meses desde febrero de 2024</small></div></div><form className="seedlings-calculator" onSubmit={calculate}><label htmlFor="capitalReal">Cantidad de plantines <span>(base)</span></label><input id="capitalReal" name="capitalReal" type="number" min="0" step="1000" value={base} onChange={(event) => setBase(event.target.value)} inputMode="numeric" /><button type="submit">Calcular disponibles <span>→</span></button><div className="seedlings-result" aria-live="polite"><span>Disponibles estimados</span><strong>{result.toLocaleString("es-AR")}</strong><small>plantines</small></div><p className="seedlings-note">La estimación aplica el modelo teórico y el redondeo definidos para el ciclo.</p></form></section><CycleCalculator /></main>;
}

function CycleCalculator() {
  const [cycleMonths, setCycleMonths] = useState(() => String(currentMonths()));
  const [calculatedMonths, setCalculatedMonths] = useState(currentMonths);
  const [standard, setStandard] = useState(() => Math.floor(futureValue(0, 1000, 3, currentMonths()) / 1000) * 1000 + 3000);
  const [reinforced, setReinforced] = useState(() => Math.floor(futureValue(0, 2300, 7, currentMonths()) / 1000) * 1000);

  function calculateCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Math.max(0, Number.parseFloat(cycleMonths) || 0);
    setCalculatedMonths(value);
    setStandard(Math.floor(futureValue(0, 1000, 3, value) / 1000) * 1000 + 3000);
    setReinforced(Math.floor(futureValue(0, 2300, 7, value) / 1000) * 1000);
  }

  return <section className="cycle-estimator"><div className="cycle-estimator-copy"><p className="seedlings-kicker">Proyección por ciclo</p><h2>Compará cada<br /><em>modalidad.</em></h2><p>Elegí la duración del ciclo para estimar plantines estándar y reforzados.</p></div><form className="cycle-estimator-form" onSubmit={calculateCycle}><label htmlFor="cycleMonths">Ciclo <span>(meses)</span></label><div className="cycle-input-row"><input id="cycleMonths" type="number" min="0" step="1" value={cycleMonths} onChange={(event) => setCycleMonths(event.target.value)} required /><button type="submit">Calcular <span>→</span></button></div><div className="cycle-results" aria-live="polite"><article className="standard"><span>Estándar</span><strong>{standard.toLocaleString("es-AR")}</strong><small>plantines</small></article><article className="reinforced"><span>Reforzados</span><strong>{reinforced.toLocaleString("es-AR")}</strong><small>plantines</small></article></div><p className="seedlings-note">Estimación para un ciclo de <strong>{calculatedMonths}</strong> meses.</p></form></section>;
}
