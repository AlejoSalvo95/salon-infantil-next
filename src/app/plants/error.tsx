"use client";

import { useEffect } from "react";

export default function PlantsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("plants_render_error", {
      message: error.message,
      digest: error.digest ?? null,
      route: window.location.pathname,
      occurredAt: new Date().toISOString(),
    });
  }, [error]);

  return <main className="plants-recovery"><a className="plants-logo" href="/">☁ nube</a><section><span aria-hidden="true">☘</span><p className="plants-kicker">Garden connection</p><h1>Connection<br/><em>paused.</em></h1><p>The plant data service could not be loaded. Try again once; if it persists, check the server logs{error.digest ? ` with reference ${error.digest}` : ""}.</p><button type="button" onClick={reset}>Try again <span>→</span></button></section></main>;
}
