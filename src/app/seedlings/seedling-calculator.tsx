"use client";

import { useState, type FormEvent } from "react";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";

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

  return <main className="seedlings-page"><header className="seedlings-header"><a className="seedlings-logo" href="/"><span>☁</span> nube</a><PrivateAreaNav current="seedlings"/></header><section className="seedlings-shell"><div className="seedlings-copy"><p className="seedlings-kicker">Seedling planning tool</p><h1>Estimate your<br /><em>seedlings.</em></h1><p>Enter the starting amount to estimate how many seedlings are available in the current growing cycle.</p><div className="cycle"><span>Current growing cycle</span><strong>{months}</strong><small>months since February 2024</small></div></div><form className="seedlings-calculator" onSubmit={calculate}><label htmlFor="capitalReal">Seedling count <span>(base)</span></label><input id="capitalReal" name="capitalReal" type="number" min="0" step="1000" value={base} onChange={(event) => setBase(event.target.value)} inputMode="numeric" /><button type="submit">Estimate availability <span>→</span></button><div className="seedlings-result" aria-live="polite"><span>Estimated availability</span><strong>{result.toLocaleString("en-US")}</strong><small>seedlings</small></div><p className="seedlings-note">The estimate applies the growth model and rounding defined for this cycle.</p></form></section><CycleCalculator /></main>;
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

  return <section className="cycle-estimator"><div className="cycle-estimator-copy"><p className="seedlings-kicker">Growing-cycle projection</p><h2>Compare each<br /><em>growing plan.</em></h2><p>Choose a growing-cycle length to estimate standard and reinforced seedlings.</p></div><form className="cycle-estimator-form" onSubmit={calculateCycle}><label htmlFor="cycleMonths">Cycle <span>(months)</span></label><div className="cycle-input-row"><input id="cycleMonths" type="number" min="0" step="1" value={cycleMonths} onChange={(event) => setCycleMonths(event.target.value)} required /><button type="submit">Calculate <span>→</span></button></div><div className="cycle-results" aria-live="polite"><article className="standard"><span>Standard</span><strong>{standard.toLocaleString("en-US")}</strong><small>seedlings</small></article><article className="reinforced"><span>Reinforced</span><strong>{reinforced.toLocaleString("en-US")}</strong><small>seedlings</small></article></div><p className="seedlings-note">Estimate for a growing cycle of <strong>{calculatedMonths}</strong> months.</p></form></section>;
}
