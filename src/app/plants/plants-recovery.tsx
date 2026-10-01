"use client";

import type { PlantLoadDiagnostic } from "@/lib/plants-diagnostics";
import "./plants.css";

export function PlantsRecovery({ diagnostic, digest, onRetry }: { diagnostic?: PlantLoadDiagnostic; digest?: string; onRetry?: () => void }) {
  return <main className="plants-recovery"><a className="plants-logo" href="/">☁ nube</a><section><span aria-hidden="true">☘</span><p className="plants-kicker">Garden connection</p><h1>Connection<br/><em>paused.</em></h1><p>{diagnostic?.summary ?? "The page could not be displayed. Reload it to request fresh data."}</p>
    <dl className="plants-error-details">
      <dt>Reference</dt><dd>{diagnostic?.incidentId ?? digest ?? "Unavailable"}</dd>
      {diagnostic && <><dt>Time (UTC)</dt><dd>{diagnostic.occurredAt}</dd><dt>Stage / query</dt><dd>{diagnostic.query}</dd><dt>Category</dt><dd>{diagnostic.category}</dd><dt>Attempts</dt><dd>{diagnostic.attempts}</dd><dt>Elapsed</dt><dd>{(diagnostic.elapsedMs / 1000).toFixed(1)} seconds</dd>{diagnostic.status !== null && <><dt>HTTP status</dt><dd>{diagnostic.status}</dd></>}{diagnostic.code && <><dt>Error code</dt><dd>{diagnostic.code}</dd></>}</>}
    </dl>
    <p>Share this reference and the details above if the problem persists. Server logs contain the matching diagnostic event.</p>
    <button type="button" onClick={() => { if (onRetry) onRetry(); else window.location.reload(); }}>Try again <span>→</span></button>
    {onRetry && <button type="button" onClick={() => window.location.reload()}>Reload page ↻</button>}
  </section></main>;
}