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
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-medium">Odontograma</h2>
      <div className="grid gap-3 md:grid-cols-2">
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
                  className={`relative flex aspect-square min-h-10 items-center justify-center rounded-lg border text-xs font-medium ${
                    whole ? CONDITIONS[whole.condition].color : "bg-white"
                  } ${tooth === t ? "border-teal-600 ring-2 ring-teal-600" : "border-slate-300"}`}
                >
                  {t}
                  {count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1 text-[10px] text-white">{count}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {tooth && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-medium">Diente {tooth}</p>
          <div className="flex flex-wrap gap-2">
            {SURFACES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSurfaces((cur) => (cur.includes(s.key) ? cur.filter((x) => x !== s.key) : [...cur, s.key]))}
                className={`rounded-lg border px-3 py-2 text-sm ${surfaces.includes(s.key) ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-white"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{surfaces.length ? "Se aplicará a las superficies elegidas" : "Sin superficie: se aplicará a todo el diente"}</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CONDITIONS) as ConditionKey[]).map((c) => (
              <button key={c} type="button" disabled={pending} onClick={() => apply(c)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm disabled:opacity-60">
                <span className={`h-4 w-4 rounded-full border ${CONDITIONS[c].color}`} />
                {CONDITIONS[c].label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {(Object.keys(CONDITIONS) as ConditionKey[]).filter((c) => c !== "HEALTHY").map((c) => (
          <li key={c} className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full border ${CONDITIONS[c].color}`} />{CONDITIONS[c].label}</li>
        ))}
      </ul>
    </section>
  );
}
