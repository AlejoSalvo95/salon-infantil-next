"use client";

import { useEffect, useState } from "react";

export interface RegistroFlores {
  fecha: string;
  valorReferencia: number;
  fuente?: "api" | "csv";
  compra?: number;
  floresRecibidas?: number;
}

export function useFlores(periodo = "max") {
  const [historial, setHistorial] = useState<RegistroFlores[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function cargarFlores() {
      try {
        setCargando(true);
        setError(null);
        const params = new URLSearchParams({ periodo });
        const respuesta = await fetch(`/api/flores?${params}`, {
          signal: controller.signal,
        });
        const datos = await respuesta.json();

        if (!respuesta.ok || datos.error) {
          throw new Error(datos.error || "Flower data could not be loaded");
        }

        setHistorial(datos.historial || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Flower data could not be loaded");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }

    cargarFlores();
    return () => controller.abort();
  }, [periodo]);

  return { historial, cargando, error };
}
