"use client";

import { useEffect } from "react";
import { PlantsRecovery } from "./plants-recovery";

export default function PlantsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("plants_render_error", {
      message: error.message,
      digest: error.digest ?? null,
      route: window.location.pathname,
      occurredAt: new Date().toISOString(),
    });
  }, [error]);

  return <PlantsRecovery digest={error.digest} onRetry={reset}/>;
}
