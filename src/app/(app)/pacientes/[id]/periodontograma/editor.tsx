"use client";

import { useEffect, useState, useTransition } from "react";
import { QUADRANTS } from "@/lib/catalogs";
import { cal, emptyTooth, sitesOf, summarize, type Perio, type PerioTooth, type Site } from "@/lib/perio";
import { savePerio } from "./actions";

const UPPER = [...QUADRANTS[0], ...QUADRANTS[1]];
const LOWER = [...QUADRANTS[2], ...QUADRANTS[3]];
const ORDER = [...UPPER, ...LOWER];
const SIDES = ["v", "l"] as const;
type Side = (typeof SIDES)[number];
type Field = "pd" | "gm";

const mesialRight = (t: number) => [1, 4].includes(Math.floor(t / 10));
// Columna visible (izq→der) a índice anatómico (0 distal, 1 central, 2 mesial).
const anat = (t: number) => (mesialRight(t) ? [0, 1, 2] : [2, 1, 0]);
const COL_NAME = (t: number) => anat(t).map((i) => ["Distal", "Central", "Mesial"][i]);
const isUpper = (t: number) => t < 30;

const PD_KEYS = Array.from({ length: 13 }, (_, i) => i);
const GM_KEYS = Array.from({ length: 13 }, (_, i) => i - 3);

function pdClass(pd: number | undefined) {
  if (pd === undefined) return "bg-slate-100 text-slate-600";
  if (pd >= 6) return "bg-red-100 text-red-900";
  if (pd >= 4) return "bg-amber-100 text-amber-900";
  return "bg-green-100 text-green-900";
}
function maxPd(t: PerioTooth | undefined) {
  const v = t ? sitesOf(t).map((s) => s.pd).filter((x): x is number => x !== undefined) : [];
  return v.length ? Math.max(...v) : undefined;
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export default function PerioEditor({ patientId, initial }: { patientId: string; initial: Perio }) {
  const [data, setData] = useState<Perio>(() => clone(initial));
  const [sel, setSel] = useState<{ tooth: number; side: Side; col: number }>({ tooth: 18, side: "v", col: 0 });
  const [field, setField] = useState<Field>("pd");
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string }>();
  const [saving, startSave] = useTransition();

  const tooth = data[sel.tooth] ?? emptyTooth();
  const summary = summarize(data);

  useEffect(() => {
    document.querySelector(`[data-t="${sel.tooth}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [sel.tooth]);

  function edit(t: number, fn: (x: PerioTooth) => void) {
    setData((d) => {
      const next = clone(d);
      const cur = next[t] ?? emptyTooth();
      fn(cur);
      next[t] = cur;
      return next;
    });
    setMsg(undefined);
  }

  function advance(from: { tooth: number; side: Side; col: number }) {
    const pos = (from.side === "v" ? 0 : 3) + from.col;
    if (pos < 5) {
      const n = pos + 1;
      return setSel({ tooth: from.tooth, side: n < 3 ? "v" : "l", col: n % 3 });
    }
    for (let i = ORDER.indexOf(from.tooth) + 1; i < ORDER.length; i++) {
      if (!data[ORDER[i]]?.missing) return setSel({ tooth: ORDER[i], side: "v", col: 0 });
    }
  }

  function enter(value: number | undefined) {
    if (tooth.missing) return;
    const idx = anat(sel.tooth)[sel.col];
    edit(sel.tooth, (x) => {
      const s: Site = x[sel.side][idx];
      if (value === undefined) delete s[field];
      else s[field] = value;
    });
    if (value !== undefined) advance(sel);
  }

  const toggleSite = (side: Side, col: number, k: "bop" | "plq") =>
    edit(sel.tooth, (x) => {
      const s = x[side][anat(sel.tooth)[col]];
      if (s[k]) delete s[k];
      else s[k] = true;
    });

  function save() {
    startSave(async () => {
      const res = await savePerio(patientId, data);
      setMsg(res);
    });
  }

  const keys = field === "pd" ? PD_KEYS : GM_KEYS;
  const sideLabel = (side: Side) => (side === "v" ? "Vestibular" : isUpper(sel.tooth) ? "Palatino" : "Lingual");

  const arch = (teeth: number[]) => (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {teeth.map((t, i) => {
        const x = data[t];
        const m = maxPd(x);
        return (
          <button
            key={t}
            type="button"
            data-t={t}
            onClick={() => setSel({ tooth: t, side: "v", col: 0 })}
            aria-label={`Diente ${t}`}
            className={`flex min-h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border-2 text-sm font-semibold ${i === 8 ? "ml-3" : ""} ${
              x?.missing ? "border-dashed border-slate-500 bg-slate-200 text-slate-600" : `${pdClass(m)} border-slate-500`
            } ${sel.tooth === t ? "outline-4 outline-offset-1 outline-teal-700" : ""}`}
          >
            {t}
            <span className="text-[11px] font-bold">{x?.missing ? "Au" : m ?? ""}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="section-title">Periodontograma</h2>
        <p className="muted">Toca un diente y escribe con el teclado: el cursor avanza solo por los 6 sitios y pasa al siguiente diente.</p>
        {arch(UPPER)}
        {arch(LOWER)}
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">Diente {sel.tooth}</h3>
          <div className="flex overflow-hidden rounded-lg border border-slate-500" role="group" aria-label="Dato a registrar">
            {([["pd", "Sondaje (mm)"], ["gm", "Recesión (mm)"]] as const).map(([k, label], i) => (
              <button key={k} type="button" aria-pressed={field === k} onClick={() => setField(k)} className={`min-h-11 px-3 text-sm font-semibold ${i ? "border-l border-slate-500" : ""} ${field === k ? "bg-teal-700 text-white" : "bg-white text-slate-900"}`}>{label}</button>
            ))}
          </div>
        </div>

        {tooth.missing ? (
          <p className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-slate-900">Diente ausente.</p>
        ) : (
          SIDES.map((side) => (
            <div key={side}>
              <p className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-700">{sideLabel(side)}</p>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((col) => {
                  const s = tooth[side][anat(sel.tooth)[col]];
                  const active = sel.side === side && sel.col === col;
                  const c = cal(s);
                  return (
                    <div key={col} className={`rounded-lg border-2 p-1 ${active ? "border-teal-700 ring-2 ring-teal-700" : "border-slate-400"}`}>
                      <button type="button" onClick={() => setSel({ ...sel, side, col })} aria-label={`${sideLabel(side)} ${COL_NAME(sel.tooth)[col]}`} className={`flex min-h-16 w-full flex-col items-center justify-center rounded-md ${pdClass(s.pd)}`}>
                        <span className="text-2xl font-bold leading-none">{s.pd ?? "–"}</span>
                        <span className="text-[11px] font-semibold">
                          {COL_NAME(sel.tooth)[col]}
                          {s.gm !== undefined && s.gm !== 0 ? ` · ${s.gm > 0 ? "Rec" : "Mg"} ${Math.abs(s.gm)}` : ""}
                          {c !== undefined && s.gm ? ` · NIC ${c}` : ""}
                        </span>
                      </button>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button type="button" aria-pressed={!!s.bop} onClick={() => toggleSite(side, col, "bop")} className={`min-h-9 rounded text-xs font-bold ${s.bop ? "bg-red-700 text-white" : "border border-slate-400 bg-white text-slate-800"}`}>Sang.</button>
                        <button type="button" aria-pressed={!!s.plq} onClick={() => toggleSite(side, col, "plq")} className={`min-h-9 rounded text-xs font-bold ${s.plq ? "bg-amber-400 text-slate-900" : "border border-slate-400 bg-white text-slate-800"}`}>Placa</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {!tooth.missing && (
          <div className="sticky bottom-[3.9rem] z-10 -mx-2 rounded-lg border border-slate-300 bg-white p-2 shadow-lg md:static md:mx-0 md:border-0 md:p-0 md:shadow-none">
            <p className="label mb-2 hidden md:block">{field === "pd" ? "Profundidad de sondaje" : "Recesión (+) / margen sobre la unión (−)"}</p>
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {keys.map((k) => (
                <button key={k} type="button" onClick={() => enter(k)} className="min-h-11 rounded-lg border border-slate-500 bg-white text-lg font-bold md:min-h-12 text-slate-900 hover:bg-slate-100 active:bg-teal-100">{k}</button>
              ))}
              <button type="button" onClick={() => enter(undefined)} aria-label="Borrar valor" className="min-h-11 rounded-lg border border-slate-500 bg-slate-100 text-lg font-bold text-slate-900 md:min-h-12">⌫</button>
            </div>
          </div>
        )}

        <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900">
            <input type="checkbox" checked={!!tooth.missing} onChange={(e) => edit(sel.tooth, (x) => { x.missing = e.target.checked || undefined; })} className="h-5 w-5 accent-teal-700" />
            Ausente
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900">
            <input type="checkbox" checked={!!tooth.sup} onChange={(e) => edit(sel.tooth, (x) => { x.sup = e.target.checked || undefined; })} className="h-5 w-5 accent-teal-700" />
            Supuración
          </label>
          <label className="label">Movilidad
            <select className="field mt-0" value={tooth.mob ?? 0} onChange={(e) => edit(sel.tooth, (x) => { x.mob = Number(e.target.value) || undefined; })}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="label">Furca
            <select className="field mt-0" value={tooth.furc ?? 0} onChange={(e) => edit(sel.tooth, (x) => { x.furc = Number(e.target.value) || undefined; })}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>Grado {n}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="section-title">Resumen</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Sondaje promedio", `${summary.meanPd} mm`],
            ["Sitios ≥ 4 mm", summary.n4],
            ["Sitios ≥ 6 mm", summary.n6],
            ["NIC máximo", `${summary.maxCal} mm`],
            ["Sangrado", `${summary.bopPct}%`],
            ["Placa", `${summary.plaquePct}%`],
            ["Dientes ausentes", summary.missing],
            ["Con movilidad", summary.mobile],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg border border-slate-300 p-3">
              <dt className="muted">{k}</dt>
              <dd className="text-xl font-bold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        {msg?.error && <p role="alert" className="error-text">{msg.error}</p>}
        {msg?.ok && <p className="ok-text">Periodontograma guardado como una nueva versión</p>}
        <button type="button" onClick={save} disabled={saving} className="btn-primary w-full md:w-auto">{saving ? "Guardando…" : "Guardar periodontograma"}</button>
        <p className="muted">Cada guardado crea una versión nueva; las anteriores se conservan para comparar la evolución.</p>
      </section>
    </div>
  );
}
