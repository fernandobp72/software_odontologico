"use client";

import { useRef, useState, useTransition } from "react";
import { CONDITIONS, QUADRANTS, SURFACES, type ConditionKey } from "@/lib/catalogs";
import { parseOdontogram } from "@/lib/voice";
import VoiceButton, { VoiceBox } from "./voice-button";
import { applyFindings, saveInitialSnapshot } from "./actions";

export type Finding = { tooth: number; surface: string | null; condition: ConditionKey };
type Change = { tooth: number; surface: string | null; condition: ConditionKey };

const SURFACE_KEYS = SURFACES.map((s) => s.key);
const key = (tooth: number, surface: string | null) => `${tooth}|${surface ?? ""}`;
const TOOL_ORDER = Object.keys(CONDITIONS) as ConditionKey[];

// Polígonos de las 5 superficies en un viewBox 100x100. M/D se intercambian según el cuadrante.
function shapes(tooth: number) {
  const mesialRight = [1, 4].includes(Math.floor(tooth / 10));
  const left = mesialRight ? "D" : "M";
  const right = mesialRight ? "M" : "D";
  // Arriba: vestibular hacia afuera (arriba) y palatino hacia la línea central (abajo).
  // Abajo se invierte: el lingual queda hacia la línea central (arriba) y el vestibular abajo.
  const lower = tooth > 30;
  return [
    { s: lower ? "L" : "V", pts: "2,2 98,2 70,30 30,30" },
    { s: lower ? "V" : "L", pts: "30,70 70,70 98,98 2,98" },
    { s: left, pts: "2,2 30,30 30,70 2,98" },
    { s: right, pts: "98,2 98,98 70,70 70,30" },
    { s: "O", pts: "30,30 70,30 70,70 30,70" },
  ];
}

function ToothSvg({
  tooth,
  fillOf,
  whole,
  onSurface,
  label,
  pendingSurf,
}: {
  tooth: number;
  fillOf: (surface: string) => ConditionKey;
  whole?: ConditionKey;
  onSurface?: (surface: string) => void;
  label?: boolean;
  pendingSurf?: string[];
}) {
  const crossed = whole === "EXTRACTED" || whole === "MISSING";
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Diente ${tooth}`}>
      {shapes(tooth).map(({ s, pts }) => (
        <polygon
          key={s}
          points={pts}
          fill={CONDITIONS[fillOf(s)].fill}
          stroke="#475569"
          strokeWidth={3}
          strokeLinejoin="round"
          className={onSurface ? "cursor-pointer" : undefined}
          onClick={onSurface ? () => onSurface(s) : undefined}
        />
      ))}
      {pendingSurf?.includes("*") && (
        <rect x="6" y="6" width="88" height="88" fill="none" stroke="#dc2626" strokeWidth={6} strokeDasharray="10 6" pointerEvents="none" />
      )}
      {shapes(tooth)
        .filter(({ s }) => pendingSurf?.includes(s))
        .map(({ s, pts }) => (
          <polygon key={`p${s}`} points={pts} fill="none" stroke="#dc2626" strokeWidth={7} strokeDasharray="8 5" pointerEvents="none" />
        ))}
      {label &&
        shapes(tooth).map(({ s }) => {
          const sh = shapes(tooth);
          const pos: Record<string, [number, number]> = { O: [50, 54] };
          pos[sh[0].s] = [50, 20];
          pos[sh[1].s] = [50, 86];
          pos[sh[2].s] = [14, 54];
          pos[sh[3].s] = [86, 54];
          const [x, y] = pos[s];
          const dark = ["CARIES", "FILLING", "SEALANT", "FRACTURE", "ROOT_CANAL", "IMPLANT", "EXTRACTED", "IMPACTED"].includes(fillOf(s));
          return (
            <text key={`t${s}`} x={x} y={y} textAnchor="middle" fontSize="13" fontWeight="700" fill={dark ? "#fff" : "#0f172a"} pointerEvents="none">
              {s}
            </text>
          );
        })}
      {crossed && <path d="M6 6L94 94M94 6L6 94" stroke={whole === "EXTRACTED" ? "#fff" : "#475569"} strokeWidth={6} pointerEvents="none" />}
    </svg>
  );
}

export default function Odontogram({
  patientId,
  findings,
  canEdit,
  initial,
  planned,
}: {
  patientId: string;
  findings: Finding[];
  canEdit: boolean;
  initial: Finding[] | null;
  planned: { tooth: number; surfaces: string }[];
}) {
  const [state, setState] = useState(() => new Map(findings.map((f) => [key(f.tooth, f.surface), f.condition])));
  const [tool, setTool] = useState<ConditionKey>("CARIES");
  const [tooth, setTooth] = useState<number | null>(null);
  const [view, setView] = useState<"actual" | "initial">("actual");
  const [hasInitial, setHasInitial] = useState(!!initial);
  const initialMap = new Map((initial ?? []).map((f) => [key(f.tooth, f.surface), f.condition]));
  const viewing = view === "initial" && initial ? initialMap : state;
  const editable = canEdit && viewing === state;
  const pendingOf = (t: number) => planned.filter((p) => p.tooth === t).flatMap((p) => (p.surfaces ? p.surfaces.split("") : ["*"]));
  const [undo, setUndo] = useState<Change[][]>([]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const [voice, setVoice] = useState<{ text: string; lines: string[]; warnings: string[] }>();

  const getNow = (t: number, s: string | null): ConditionKey => viewing.get(key(t, s)) ?? "HEALTHY";
  const get = getNow;
  const fillOf = (t: number) => (s: string): ConditionKey => {
    const own = get(t, s);
    return own !== "HEALTHY" ? own : get(t, null);
  };

  function plan(condition: ConditionKey, t: number, surface: string | null, get: (t: number, s: string | null) => ConditionKey = getNow): Change[] {
    const out: Change[] = [];
    const set = (s: string | null, c: ConditionKey) => get(t, s) !== c && out.push({ tooth: t, surface: s, condition: c });
    const clearAll = () => [null, ...SURFACE_KEYS].forEach((s) => set(s, "HEALTHY"));

    if (condition === "HEALTHY") {
      if (surface === null) clearAll();
      else {
        set(surface, "HEALTHY");
        // Si el diente tenía un estado de diente completo, se quita para poder borrar la superficie.
        if (get(t, null) !== "HEALTHY") {
          set(null, "HEALTHY");
          SURFACE_KEYS.filter((k) => k !== surface && get(t, k) === "HEALTHY").forEach((k) => out.push({ tooth: t, surface: k, condition: get(t, null) }));
        }
      }
    } else if (CONDITIONS[condition].scope === "tooth") {
      SURFACE_KEYS.forEach((s) => set(s, "HEALTHY"));
      set(null, condition);
    } else {
      if (get(t, null) !== "HEALTHY" && CONDITIONS[get(t, null)].scope === "tooth") set(null, "HEALTHY");
      (surface === null ? SURFACE_KEYS : [surface]).forEach((s) => set(s, condition));
    }
    return out;
  }

  function commit(changes: Change[], reverse: Change[], pushUndo: boolean) {
    if (!changes.length) return;
    const before = state;
    setState((cur) => {
      const next = new Map(cur);
      changes.forEach((c) => next.set(key(c.tooth, c.surface), c.condition));
      return next;
    });
    if (pushUndo) setUndo((u) => [...u, reverse].slice(-30));
    start(async () => {
      const res = await applyFindings({ patientId, changes });
      if (res.error) {
        setState(before);
        setError(res.error);
      } else setError(undefined);
    });
  }

  function paint(surface: string | null) {
    if (!tooth) return;
    const changes = plan(tool, tooth, surface);
    commit(changes, changes.map((c) => ({ ...c, condition: get(c.tooth, c.surface) })), true);
  }

  // Voz: cada frase se interpreta por reglas y se aplica de una vez (un solo «Deshacer» la revierte).
  function heard(text: string) {
    const { commands, warnings } = parseOdontogram(text, tooth);
    const sim = new Map(state);
    const simGet = (t: number, s: string | null): ConditionKey => sim.get(key(t, s)) ?? "HEALTHY";
    const all: Change[] = [];
    const lines: string[] = [];
    for (const c of commands) {
      const targets = c.surfaces ?? [null];
      for (const sf of targets) {
        const ch = plan(c.condition, c.tooth, sf, simGet);
        ch.forEach((x) => sim.set(key(x.tooth, x.surface), x.condition));
        all.push(...ch);
      }
      lines.push(`${c.tooth}${c.surfaces ? " " + c.surfaces.join("") : ""} · ${CONDITIONS[c.condition].label}`);
    }
    if (commands.length) setTooth(commands[commands.length - 1].tooth);
    if (all.length) {
      const orig = new Map<string, Change>();
      all.forEach((x) => { const k = key(x.tooth, x.surface); if (!orig.has(k)) orig.set(k, { ...x, condition: state.get(k) ?? "HEALTHY" }); });
      const final = new Map<string, Change>();
      all.forEach((x) => final.set(key(x.tooth, x.surface), x));
      commit([...final.values()], [...orig.values()], true);
    }
    setVoice({ text, lines, warnings });
  }

  function undoLast() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo((u) => u.slice(0, -1));
    commit(last, [], false);
  }

  function freezeInitial() {
    start(async () => {
      const res = await saveInitialSnapshot(patientId);
      if (res.error) setError(res.error);
      else {
        setError(undefined);
        setHasInitial(true);
        setView("initial");
      }
    });
  }

  function pick(t: number) {
    setTooth(t);
    requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const wholeOf = (t: number) => {
    const w = get(t, null);
    return w === "HEALTHY" ? undefined : w;
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">Odontograma</h2>
        <div className="flex flex-wrap gap-2">
          {(hasInitial || canEdit) && (
            <div className="flex overflow-hidden rounded-lg border border-slate-500" role="group" aria-label="Versión del odontograma">
              <button type="button" onClick={() => setView("actual")} aria-pressed={view === "actual"} className={`min-h-11 px-3 text-sm font-semibold ${view === "actual" ? "bg-teal-700 text-white" : "bg-white text-slate-900"}`}>Actual</button>
              <button type="button" disabled={!initial} onClick={() => setView("initial")} aria-pressed={view === "initial"} className={`min-h-11 border-l border-slate-500 px-3 text-sm font-semibold disabled:opacity-50 ${view === "initial" ? "bg-teal-700 text-white" : "bg-white text-slate-900"}`}>Inicial</button>
            </div>
          )}
          {editable && <VoiceButton onPhrase={heard} label="🎤 Dictar hallazgos" />}
          {editable && (
            <button type="button" className="btn-secondary" onClick={undoLast} disabled={!undo.length || pending}>
              Deshacer
            </button>
          )}
        </div>
      </div>
      {canEdit && !hasInitial && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="muted flex-1">Cuando el estado de la boca esté completo, fíjalo como odontograma inicial. No podrá modificarse después.</p>
          <button type="button" className="btn-secondary" onClick={freezeInitial} disabled={pending}>Fijar como inicial</button>
        </div>
      )}
      {view === "initial" && initial && <p className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-sm font-semibold text-slate-900">Odontograma inicial (solo lectura)</p>}

      {editable && (
        <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
          <VoiceBox onPhrase={heard} />
          {voice && (
            <div role="status">
              <p className="muted">Escuché: «{voice.text}»</p>
              {voice.lines.length > 0 && <p className="mt-1 font-semibold">Aplicado: {voice.lines.join(" · ")}</p>}
              {voice.warnings.map((w) => <p key={w} className="error-text mt-1">{w}</p>)}
            </div>
          )}
        </div>
      )}
      {editable && (
        <div>
          <p className="label mb-2">1. Elige el estado</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado a aplicar">
            {TOOL_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={tool === c}
                onClick={() => setTool(c)}
                className={`flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold text-slate-900 ${
                  tool === c ? "border-teal-700 bg-teal-50 ring-2 ring-teal-700" : "border-slate-400 bg-white hover:bg-slate-100"
                }`}
              >
                <span className={`h-4 w-4 rounded-full border-2 ${CONDITIONS[c].cls}`} />
                {CONDITIONS[c].label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        <div className="@container">
          {editable && <p className="label mb-2">2. Toca el diente</p>}
          <div className="space-y-3">
            {[[0, 1], [2, 3]].map((pair, r) => (
              <div key={r} className={`grid gap-x-6 gap-y-3 @2xl:grid-cols-2 ${r ? "border-t-4 border-slate-400 pt-3" : ""}`}>
                {pair.map((i) => (
                  <div key={i}>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                      {["Cuadrante 1 · superior derecho", "Cuadrante 2 · superior izquierdo", "Cuadrante 4 · inferior derecho", "Cuadrante 3 · inferior izquierdo"][i]}
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {QUADRANTS[i].map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={!editable}
                          onClick={() => pick(t)}
                          aria-label={`Diente ${t}`}
                          className={`flex flex-col items-center rounded-md p-0.5 ${tooth === t ? "bg-teal-100 outline-3 outline-teal-700" : ""}`}
                        >
                          <span className="text-xs font-semibold text-slate-900">{t}</span>
                          <span className="aspect-square w-full"><ToothSvg tooth={t} fillOf={fillOf(t)} whole={wholeOf(t)} pendingSurf={pendingOf(t)} /></span>
                          <span className="h-4 text-[11px] font-bold leading-4 text-slate-800">{wholeOf(t) ? CONDITIONS[wholeOf(t)!].abbr : ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div ref={panel} className="rounded-lg border border-slate-300 bg-slate-50 p-3">
          {tooth && editable ? (
            <div className="space-y-3 sm:flex sm:items-center sm:gap-6 sm:space-y-0">
              <div className="mx-auto aspect-square w-48 max-w-full shrink-0 sm:mx-0">
                <ToothSvg tooth={tooth} fillOf={fillOf(tooth)} whole={wholeOf(tooth)} pendingSurf={pendingOf(tooth)} onSurface={(s) => paint(s)} label />
              </div>
              <div className="space-y-3">
              <p className="font-semibold text-slate-900">Diente {tooth}</p>
              <p className="muted">
                V vestibular · L lingual/palatino · M mesial · D distal · O oclusal. En el diente el lado de la línea central es el palatino/lingual. Toca una superficie para aplicar «{CONDITIONS[tool].label}».
              </p>
              <button type="button" className="btn-secondary w-full" onClick={() => paint(null)}>
                {CONDITIONS[tool].scope === "tooth" ? `Aplicar ${CONDITIONS[tool].label.toLowerCase()} al diente` : `${CONDITIONS[tool].label} en todo el diente`}
              </button>
              </div>
            </div>
          ) : (
            <p className="muted">{editable ? "Toca un diente para marcar sus superficies, o pulsa «Dictar hallazgos»: «diente 16 oclusal mesial caries de dentina»; «ausentes 18 28 38 48»." : "Solo lectura."}</p>
          )}
          {error && <p role="alert" className="error-text mt-2">{error}</p>}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-800">
        <li className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-sm border-2 border-dashed border-red-600" />Por hacer (plan)</li>
        {TOOL_ORDER.filter((c) => c !== "HEALTHY").map((c) => (
          <li key={c} className="flex items-center gap-1.5"><span className={`h-4 w-4 rounded-full border-2 ${CONDITIONS[c].cls}`} />{CONDITIONS[c].label} ({CONDITIONS[c].abbr})</li>
        ))}
      </ul>
    </section>
  );
}
