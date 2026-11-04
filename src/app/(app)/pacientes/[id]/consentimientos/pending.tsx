"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelConsentRequest } from "./actions";

export type PendingRow = { id: string; title: string; method: string; signerName: string; expires: string };

// Solicitudes enviadas que el paciente todavía no firma. Se refresca sola para que aparezca el consentimiento apenas firme.
export default function PendingRequests({ rows }: { rows: PendingRow[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <section className="space-y-2">
      <h2 className="section-title">Esperando firma</h2>
      <ul className="card divide-y divide-slate-200 p-0 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span><strong>{r.title}</strong><span className="muted block">{r.method === "QR" ? "QR en el consultorio" : "Enlace a distancia"} · para {r.signerName} · vence {r.expires}</span></span>
            <form action={cancelConsentRequest.bind(null, r.id)}><button className="min-h-11 px-2 font-semibold text-red-800 underline">Cancelar</button></form>
          </li>
        ))}
      </ul>
    </section>
  );
}
