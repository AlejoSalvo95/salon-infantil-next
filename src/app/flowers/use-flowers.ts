"use client";

import { useEffect, useState } from "react";

export interface FlowerRecord {
  date: string;
  referencePrice: number;
  source?: "api" | "csv";
  purchaseAmount?: number;
  flowersReceived?: number;
}

export function useFlowers(range = "max") {
  const [history, setHistorial] = useState<FlowerRecord[]>([]);
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFlowers() {
      try {
        setCargando(true);
        setError(null);
        const params = new URLSearchParams({ range });
        const response = await fetch(`/api/flowers?${params}`, {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          throw new Error(payload.error || "Flower data could not be loaded");
        }

        setHistorial(payload.history || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Flower data could not be loaded");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }

    loadFlowers();
    return () => controller.abort();
  }, [range]);

  return { history, loading, error };
}
