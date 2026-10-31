"use client";

import { useEffect, useState } from "react";

type S = { status: "ok" | "none" | "unknown"; count?: number; note?: string };

// Contrasta la presentación con el CUM del INVIMA (datos abiertos); si el servicio no responde, no estorba.
export default function InvimaBadge({ drugId, presentationId }: { drugId: string; presentationId: string }) {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/vademecum?drug=${encodeURIComponent(drugId)}&pres=${encodeURIComponent(presentationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setS(j))
      .catch(() => live && setS({ status: "unknown" }));
    return () => { live = false; };
  }, [drugId, presentationId]);
  if (!s) return <span className="text-xs text-slate-600">Consultando INVIMA…</span>;
  if (s.status === "ok") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900" title="Presentación con registro sanitario vigente en el CUM del INVIMA">✓ INVIMA vigente ({s.count})</span>;
  if (s.status === "none") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900" title={s.note}>No figura en el CUM{s.note ? ` · ${s.note}` : ""}</span>;
  return <span className="text-xs text-slate-600">INVIMA: sin conexión</span>;
}
