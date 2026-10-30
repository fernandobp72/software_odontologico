"use client";

import { useState, useTransition } from "react";
import { CONDITIONS, QUADRANTS, SURFACES, type ConditionKey } from "@/lib/catalogs";
import { saveFinding } from "./actions";

export type Finding = { tooth: number; surface: string | null; condition: ConditionKey };

export default function Odontogram({ patientId, findings, canEdit }: { patientId: string; findings: Finding[]; canEdit: boolean }) {
  const [tooth, setTooth] = useState<number | null>(null);
  const [surfaces, setSurfaces] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function apply(condition: ConditionKey) {
    if (!tooth) return;
    start(async () => {
      const res = await saveFinding({ patientId, tooth, surfaces, condition });
      if (res.error) return setError(res.error);
      setError(undefined);
      setTooth(null);
      setSurfaces([]);
    });
  }

  const wholeTooth = (t: number) => findings.find((f) => f.tooth === t && f.surface === null);
  const surfaceCount = (t: number) => findings.filter((f) => f.tooth === t && f.surface !== null).length;

  return (
    <section className="card space-y-4">
      <h2 className="section-title">Odontograma</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q, i) => (
          <div key={i} className="grid grid-cols-8 gap-1">
            {q.map((t) => {
              const whole = wholeTooth(t);
              const count = surfaceCount(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => { setTooth(t); setSurfaces([]); }}
                  aria-label={`Diente ${t}`}
                  className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg border-2 text-sm font-semibold leading-tight ${
                    whole ? CONDITIONS[whole.condition].cls : "border-slate-500 bg-white text-slate-900"
                  } ${tooth === t ? "outline-4 outline-offset-1 outline-teal-600" : ""}`}
                >
                  {t}
                  {whole && <span className="text-[11px] font-bold">{CONDITIONS[whole.condition].abbr}</span>}
                  {count > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white">{count}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {tooth && (
        <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-100 p-3">
          <p className="font-semibold text-slate-900">Diente {tooth}</p>
          <div className="flex flex-wrap gap-2">
            {SURFACES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSurfaces((cur) => (cur.includes(s.key) ? cur.filter((x) => x !== s.key) : [...cur, s.key]))}
                className={`min-h-11 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${surfaces.includes(s.key) ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="muted">{surfaces.length ? "Se aplicará a las superficies elegidas" : "Sin superficie: se aplicará a todo el diente"}</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CONDITIONS) as ConditionKey[]).map((c) => (
              <button key={c} type="button" disabled={pending} onClick={() => apply(c)} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-60">
                <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${CONDITIONS[c].cls}`} />
                {CONDITIONS[c].label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="error-text">{error}</p>}
        </div>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-800">
        {(Object.keys(CONDITIONS) as ConditionKey[]).filter((c) => c !== "HEALTHY").map((c) => (
          <li key={c} className="flex items-center gap-1.5"><span className={`h-4 w-4 rounded-full border-2 ${CONDITIONS[c].cls}`} />{CONDITIONS[c].label} ({CONDITIONS[c].abbr})</li>
        ))}
      </ul>
    </section>
  );
}
