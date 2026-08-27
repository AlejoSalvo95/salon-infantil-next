"use client";

import { useEffect } from "react";

export default function PlantsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("plants_render_error", error);
    const retry = window.setTimeout(reset, 1500);
    return () => window.clearTimeout(retry);
  }, [error, reset]);

  return <main className="plants-recovery"><a className="plants-logo" href="/">☁ nube</a><section><span aria-hidden="true">☘</span><p className="plants-kicker">Garden connection</p><h1>Reconnecting<br/><em>your journal.</em></h1><p>The plant data service did not respond on the first attempt. We are trying again automatically.</p><button type="button" onClick={reset}>Try again now <span>→</span></button></section></main>;
}
