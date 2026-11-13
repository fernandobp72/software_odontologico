"use client";

import { useEffect, useState } from "react";
import { renewSession } from "./session-actions";

// Avisa 10 minutos antes de que venza la sesión (8 horas) para no perder una evolución a medias en una jornada larga.
export default function SessionWarning({ expiresAt }: { expiresAt: number }) {
  const [exp, setExp] = useState(expiresAt);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = Math.ceil((exp - now) / 60_000);
  if (left > 10) return null;
  async function renew() {
    setBusy(true);
    const r = await renewSession();
    setBusy(false);
    if ("error" in r) setError(r.error);
    else { setExp(r.expiresAt); setError(undefined); }
  }
  return (
    <div role="alert" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-200 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      <span>{error ?? (left > 0 ? `Tu sesión se cierra en ${left} ${left === 1 ? "minuto" : "minutos"}. Lo que escribes en la evolución queda guardado en este aparato.` : "Tu sesión se cerró. Lo que escribiste quedó guardado en este aparato.")}</span>
      {!error && left > 0 && <button type="button" onClick={renew} disabled={busy} className="btn-primary min-h-10">{busy ? "Renovando…" : "Seguir conectado"}</button>}
      {(error || left <= 0) && <a href="/login" className="btn-primary min-h-10">Ingresar de nuevo</a>}
    </div>
  );
}
