import type { PlantEvent, PlantMeasurement } from "@/app/plants/page";

const day = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86400000;
type CashFlow = { date: string; value: number };

// Solve in log(1 + rate), using scaled terms to avoid overflow.
export function xirr(flows: CashFlow[]): number | null {
  const byDate = new Map<string, number>();
  flows.forEach((flow) => byDate.set(flow.date, (byDate.get(flow.date) ?? 0) + flow.value));
  const values = [...byDate].map(([date, value]) => ({ date, value })).filter((flow) => flow.value !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (values.length < 2 || !values.some((flow) => flow.value < 0) || !values.some((flow) => flow.value > 0)) return null;
  const start = day(values[0].date);
  if (day(values.at(-1)!.date) <= start) return null;
  const terms = values.map((flow) => ({ value: flow.value, years: (day(flow.date) - start) / 365 }));
  const npv = (logRate: number) => {
    const exponents = terms.map((term) => Math.log(Math.abs(term.value)) - logRate * term.years);
    const scale = Math.max(...exponents);
    return terms.reduce((sum, term, index) => sum + Math.sign(term.value) * Math.exp(exponents[index] - scale), 0);
  };
  const roots: number[] = [];
  const addRoot = (root: number) => { if (!roots.some((value) => Math.abs(value - root) < 1e-7)) roots.push(root); };
  let left = -20, leftValue = npv(left);
  for (let step = 1; step <= 800; step++) {
    const right = -20 + step * 0.05, rightValue = npv(right);
    if (Math.abs(leftValue) < 1e-12) addRoot(left);
    if (leftValue * rightValue < 0) {
      let low = left, high = right, lowValue = leftValue;
      for (let iteration = 0; iteration < 100; iteration++) {
        const middle = (low + high) / 2, middleValue = npv(middle);
        if (lowValue * middleValue <= 0) high = middle;
        else { low = middle; lowValue = middleValue; }
      }
      addRoot((low + high) / 2);
    }
    left = right; leftValue = rightValue;
  }
  return roots.length === 1 ? Math.expm1(roots[0]) * 100 : null;
}

// Link Modified Dietz subperiods. End-of-day flows get zero weight that day.
// With gaps between valuations this is an approximation to true TWR.
export function linkedReturn(measurements: PlantMeasurement[], events: PlantEvent[]): number | null {
  if (measurements.length < 2) return null;
  let factor = 1;
  for (let index = 1; index < measurements.length; index++) {
    const previous = measurements[index - 1], current = measurements[index];
    const days = day(current.date) - day(previous.date);
    if (days <= 0) return null;
    const flows = events.filter((event) => event.date > previous.date && event.date <= current.date);
    const net = flows.reduce((sum, event) => sum + event.value, 0);
    const base = previous.totalHeight + flows.reduce((sum, event) => sum + event.value * (day(current.date) - day(event.date)) / days, 0);
    const profit = current.totalHeight - previous.totalHeight - net;
    if (base === 0 && profit === 0) continue;
    if (base <= 0) return null;
    const periodFactor = 1 + profit / base;
    if (periodFactor < 0 || !Number.isFinite(periodFactor)) return null;
    factor *= periodFactor;
  }
  return Number.isFinite(factor) ? (factor - 1) * 100 : null;
}

export function calculatePlantReturns(measurements: PlantMeasurement[], events: PlantEvent[]) {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) return { simple: null, annualized: null, twr: null, ytd: null, ytdStart: null, year: null };
  const flows = events.filter((event) => event.date <= latest.date && Number.isFinite(event.value));
  const net = flows.reduce((sum, event) => sum + event.value, 0);
  const simple = net > 0 ? (latest.totalHeight - net) / net * 100 : null;
  const annualized = xirr([...flows.map((event) => ({ date: event.date, value: -event.value })), { date: latest.date, value: latest.totalHeight }]);
  const year = latest.date.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const baseline = sorted.filter((measurement) => measurement.date < yearStart).at(-1);
  // Use the last observation before January 1; don't pretend inception is year-end.
  const ytdMeasurements = baseline ? [baseline, ...sorted.filter((measurement) => measurement.date >= yearStart)] : [];
  return { simple, annualized, twr: linkedReturn(sorted, flows), ytd: linkedReturn(ytdMeasurements, flows), ytdStart: baseline?.date ?? null, year };
}