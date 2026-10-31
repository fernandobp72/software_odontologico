"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { alertsFor, searchDrugs, type Alert, type DraftWithAlerts, type Flags } from "@/lib/rx-rules";
import { drugById, draftAdult, draftPediatric, quantityTextFor, VADEMECUM_VERSION, type Drug, type DraftItem, type Tag } from "@/lib/vademecum";
import InvimaBadge from "./invima-badge";
import { signPrescription } from "./actions";

type Item = DraftWithAlerts & { key: string; override: string };
type Initial = { items: DraftWithAlerts[]; excluded: { name: string; reason: string }[]; notes: string[]; reasons: string[] };
type FlagsProp = { tags: string[]; meds: string; allergyText: string; ageYears: number | null };

let seq = 0;
const newKey = () => `i${++seq}`;

export default function RxEditor({
  patientId, pediatric, weight: weight0, flags: f, initial, diagnoses, licenseOk,
}: {
  patientId: string; pediatric: boolean; weight: number | null; flags: FlagsProp; initial: Initial; diagnoses: { code: string; description: string }[]; licenseOk: boolean;
}) {
  const flags: Flags = useMemo(() => ({ tags: new Set(f.tags as Tag[]), meds: f.meds, allergyText: f.allergyText, ageYears: f.ageYears }), [f]);
  const [items, setItems] = useState<Item[]>(() => initial.items.map((i) => ({ ...i, key: newKey(), override: "" })));
  const [weight, setWeight] = useState(weight0 ? String(weight0) : "");
  const [dx, setDx] = useState(diagnoses[0]?.code ?? "");
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string>();
  const router = useRouter();
  const [pending, start] = useTransition();
  const w = Number(weight.replace(",", ".")) || null;
  const results = useMemo(() => searchDrugs(q, 8), [q]);

  const upd = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function build(d: Drug, presentationId: string): DraftItem {
    const p = d.presentations.find((x) => x.id === presentationId) ?? d.presentations[0];
    if (pediatric && !d.pedSameAsAdult) {
      const ped = w ? draftPediatric(d, p, w) : null;
      if (ped) return ped;
    }
    return draftAdult(d, p);
  }

  function addDrug(d: Drug) {
    const p = d.presentations.find((x) => (pediatric ? x.mgPerMl : x.form !== "suspension")) ?? d.presentations[0];
    const draft = build(d, p.id);
    setItems((cur) => [...cur, { ...draft, alerts: alertsFor(d, flags), reason: "Agregado a mano", key: newKey(), override: "" }]);
    setQ("");
  }

  function addFree() {
    setItems((cur) => [...cur, { drugId: null, name: "", presentationId: null, concentration: "", form: "", route: "Oral", dose: "", frequency: "", duration: "", quantity: 1, quantityText: "", instructions: "", alerts: [], reason: "Escrito a mano (no verificado en el vademécum)", key: newKey(), override: "" }]);
  }

  function changePresentation(it: Item, pid: string) {
    const d = it.drugId ? drugById(it.drugId) : undefined;
    if (!d) return;
    const draft = build(d, pid);
    upd(it.key, { ...draft, alerts: alertsFor(d, flags) });
  }

  function changeQuantity(it: Item, v: string) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    const d = it.drugId ? drugById(it.drugId) : undefined;
    const p = d?.presentations.find((x) => x.id === it.presentationId);
    upd(it.key, { quantity: n, quantityText: p && n > 0 ? quantityTextFor(p, n) : it.quantityText });
  }

  function recalcWeight() {
    setItems((cur) => cur.map((it) => {
      const d = it.drugId ? drugById(it.drugId) : undefined;
      if (!d || !it.presentationId || d.pedSameAsAdult) return it;
      const draft = build(d, it.presentationId);
      return { ...it, ...draft };
    }));
  }

  function sign() {
    setError(undefined);
    const d = diagnoses.find((x) => x.code === dx);
    start(async () => {
      const res = await signPrescription(patientId, {
        diagnosisCode: dx || undefined, diagnosisText: d?.description, weightKg: w, notes: notes || undefined,
        items: items.map((i) => ({
          drugId: i.drugId, name: i.name, concentration: i.concentration, form: i.form, route: i.route, dose: i.dose, frequency: i.frequency,
          duration: i.duration, quantity: i.quantity, quantityText: i.quantityText, instructions: i.instructions || undefined, override: i.override || undefined,
        })),
      });
      if (res?.error) setError(res.error);
      else if (res?.id) router.push(`/formula/${res.id}`);
    });
  }

  const alertCls = (a: Alert) => (a.level === "stop" ? "border-red-700 bg-red-50 text-red-900" : "border-amber-600 bg-amber-50 text-amber-900");

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="section-title">Nueva fórmula médica</h2>
        {initial.reasons.length > 0 ? (
          <p className="text-sm text-slate-900">Generada automáticamente a partir de: <strong>{initial.reasons.join(" · ")}</strong>. Revísala: puedes cambiar, quitar o agregar medicamentos.</p>
        ) : (
          <p className="text-sm text-slate-900">Agrega los medicamentos desde el vademécum.</p>
        )}
        {initial.notes.map((n) => <p key={n} className="rounded-lg border border-blue-700 bg-blue-50 p-2 text-sm text-blue-900">{n}</p>)}
        {initial.excluded.length > 0 && (
          <details className="rounded-lg border border-amber-600 bg-amber-50 p-2 text-sm text-amber-900">
            <summary className="cursor-pointer font-semibold">No se incluyeron {initial.excluded.length} medicamento(s) por seguridad</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">{initial.excluded.map((e) => <li key={e.name}><strong>{e.name}:</strong> {e.reason}</li>)}</ul>
          </details>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="label">Diagnóstico
            <select value={dx} onChange={(e) => setDx(e.target.value)} className="field">
              <option value="">Sin diagnóstico</option>
              {diagnoses.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.description}</option>)}
            </select>
          </label>
          <label className="label">Peso (kg){pediatric ? " · necesario" : ""}
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className="field" />
          </label>
          {pediatric && <div className="flex items-end"><button type="button" className="btn-secondary" onClick={recalcWeight}>Recalcular dosis por peso</button></div>}
        </div>
      </section>

      {items.map((it) => {
        const d = it.drugId ? drugById(it.drugId) : undefined;
        const blocked = it.alerts.some((a) => a.level === "stop");
        return (
          <section key={it.key} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {d ? <h3 className="text-lg font-semibold text-slate-900">{it.name}</h3> : <label className="label">Medicamento (nombre genérico)<input value={it.name} onChange={(e) => upd(it.key, { name: e.target.value })} className="field" /></label>}
                {it.reason && <p className="muted">{it.reason}</p>}
              </div>
              <button type="button" className="btn-danger min-h-10" onClick={() => setItems((c) => c.filter((x) => x.key !== it.key))}>Quitar</button>
            </div>

            {d && it.presentationId && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={it.presentationId} onChange={(e) => changePresentation(it, e.target.value)} className="field mt-0 w-full sm:w-auto" aria-label="Presentación">
                  {d.presentations.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <InvimaBadge drugId={d.id} presentationId={it.presentationId} />
              </div>
            )}

            {it.alerts.map((a) => <p key={a.text} role="alert" className={`rounded-lg border p-2 text-sm font-medium ${alertCls(a)}`}>{a.level === "stop" ? "⛔ " : "⚠ "}{a.text}</p>)}
            {!d && <p className="rounded-lg border border-amber-600 bg-amber-50 p-2 text-sm text-amber-900">Medicamento escrito a mano: no se revisan alergias ni interacciones. Verifícalas tú.</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              {!d && <label className="label">Concentración<input value={it.concentration} onChange={(e) => upd(it.key, { concentration: e.target.value })} className="field" /></label>}
              {!d && <label className="label">Forma farmacéutica<input value={it.form} onChange={(e) => upd(it.key, { form: e.target.value })} placeholder="Tableta, cápsula, jarabe…" className="field" /></label>}
              {!d && <label className="label">Vía<input value={it.route} onChange={(e) => upd(it.key, { route: e.target.value })} className="field" /></label>}
              <label className="label">Dosis<input value={it.dose} onChange={(e) => upd(it.key, { dose: e.target.value })} className="field" /></label>
              <label className="label">Frecuencia<input value={it.frequency} onChange={(e) => upd(it.key, { frequency: e.target.value })} className="field" /></label>
              <label className="label">Duración<input value={it.duration} onChange={(e) => upd(it.key, { duration: e.target.value })} className="field" /></label>
              <label className="label">Cantidad total
                <input value={it.quantity || ""} onChange={(e) => changeQuantity(it, e.target.value)} inputMode="numeric" className="field" />
              </label>
              <label className="label">Cantidad en letras<input value={it.quantityText} onChange={(e) => upd(it.key, { quantityText: e.target.value })} className="field" /></label>
            </div>
            <label className="label">Indicaciones para el paciente<textarea value={it.instructions} onChange={(e) => upd(it.key, { instructions: e.target.value })} rows={2} className="field" /></label>

            {blocked && (
              <label className="label">Motivo por el que lo formulas pese a la alerta de bloqueo
                <input value={it.override} onChange={(e) => upd(it.key, { override: e.target.value })} placeholder="Obligatorio para firmar" className="field border-red-700" />
              </label>
            )}
          </section>
        );
      })}

      <section className="card space-y-3">
        <h3 className="section-title">Agregar un medicamento</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre, grupo o indicación (ej. amoxicilina, dolor, antibiótico)" className="field" aria-label="Buscar en el vademécum" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {results.map((d) => {
            const al = alertsFor(d, flags);
            const stop = al.some((a) => a.level === "stop");
            return (
              <li key={d.id}>
                <button type="button" onClick={() => addDrug(d)} className="w-full rounded-lg border border-slate-500 bg-white p-3 text-left hover:bg-slate-100">
                  <span className="block font-semibold text-slate-900">{d.dci}</span>
                  <span className="block text-sm text-slate-700">{d.group}</span>
                  {al.length > 0 && <span className={`mt-1 block text-xs font-semibold ${stop ? "text-red-800" : "text-amber-900"}`}>{stop ? "⛔ Tiene alerta de bloqueo" : `⚠ ${al.length} alerta(s)`}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={addFree} className="btn-secondary">Escribir un medicamento a mano</button>
      </section>

      <section className="card space-y-3">
        <label className="label">Observaciones de la fórmula (opcional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field" /></label>
        {!licenseOk && <p role="alert" className="error-text">Falta tu registro profesional. Regístralo en <a href="/perfil" className="underline">Mi cuenta</a> para poder firmar.</p>}
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="button" disabled={pending || items.length === 0} onClick={sign} className="btn-primary w-full md:w-auto">{pending ? "Firmando…" : "Firmar fórmula"}</button>
        <p className="muted">Apoyo a la decisión (vademécum {VADEMECUM_VERSION}): las alertas no reemplazan tu criterio clínico. Una vez firmada no se edita; si hay un error, se anula y se genera otra. No incluye medicamentos de control especial.</p>
      </section>
    </div>
  );
}
