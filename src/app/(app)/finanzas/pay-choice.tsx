"use client";

import { useState } from "react";
import { SOURCES, addDays, type SourceKey } from "@/lib/finanzas";

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`}>{children}</button>
);

// «Ya lo pagué» (con el origen de la plata) o «Lo debo» (con fecha límite). Envía status, source, reference y dueDate.
export default function PayChoice({ today, hasOpenCash, paidLabel = "Ya lo pagué", owedLabel = "Lo pago después" }: { today: string; hasOpenCash: boolean; paidLabel?: string; owedLabel?: string }) {
  const [status, setStatus] = useState<"PAID" | "OWED">("PAID");
  const [source, setSource] = useState<SourceKey>("BANK");
  const [due, setDue] = useState(addDays(today, 8));
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="label">¿Ya se pagó?</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={status === "PAID"} onClick={() => setStatus("PAID")}>{paidLabel}</Chip>
          <Chip active={status === "OWED"} onClick={() => setStatus("OWED")}>{owedLabel}</Chip>
        </div>
        <input type="hidden" name="status" value={status} />
      </fieldset>
      {status === "PAID" ? (
        <fieldset className="space-y-2">
          <legend className="label">¿De dónde sale la plata?</legend>
          <div className="flex flex-wrap gap-2">{(Object.keys(SOURCES) as SourceKey[]).map((s) => <Chip key={s} active={source === s} onClick={() => setSource(s)}>{SOURCES[s]}</Chip>)}</div>
          <input type="hidden" name="source" value={source} />
          {source === "CASH_BOX" && !hasOpenCash && <p className="error-text">No hay caja abierta en esta sede. Ábrela en Caja o elige otro origen.</p>}
          {source === "BANK" && <label className="label">Referencia de la transferencia (opcional)<input name="reference" maxLength={60} className="field" /></label>}
        </fieldset>
      ) : (
        <label className="label">¿Hasta cuándo hay plazo?
          <input name="dueDate" type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} required className="field" />
        </label>
      )}
    </div>
  );
}
