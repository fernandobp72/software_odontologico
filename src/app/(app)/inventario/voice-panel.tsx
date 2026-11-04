"use client";

import { useState, useTransition } from "react";
import VoiceButton from "../pacientes/[id]/voice-button";
import { unitLabel } from "@/lib/inventory";
import { parseInventory, type Draft, type VoiceItem } from "@/lib/inventory-voice";
import { applyDrafts } from "./actions";

export type VoiceStockItem = VoiceItem & { perishable: boolean };

type Row = Draft & { id: string };

// Inventario por voz: se dicta (o se escribe), se arma una lista de borradores y solo se guarda al confirmar.
export default function VoicePanel({ items }: { items: VoiceStockItem[] }) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<{ ok: boolean; text: string }[]>([]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const byId = new Map(items.map((i) => [i.id, i]));

  const build = (t: string) => {
    setResults([]);
    setError(undefined);
    const d = parseInventory(t, items);
    setRows(d.map((x, i) => ({ ...x, id: `${Date.now()}-${i}` })));
    if (!d.length && t.trim()) setError("No entendí ninguna línea. Di por ejemplo: «entraron dos cajas de guantes que vencen en marzo de 2028».");
  };
  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const problem = (r: Row) => {
    const it = r.itemId ? byId.get(r.itemId) : null;
    if (!it) return "Elige el producto";
    if (!(r.quantity >= 1)) return "Falta la cantidad";
    if (r.kind === "IN" && it.perishable && !r.expiresAt) return "Falta la fecha de vencimiento";
    return null;
  };
  const ready = rows.length > 0 && rows.every((r) => !problem(r));

  const confirm = () =>
    start(async () => {
      const res = await applyDrafts(rows.map((r) => ({ kind: r.kind, itemId: r.itemId as string, quantity: r.quantity, inPack: r.inPack, expiresAt: r.expiresAt })));
      if ("error" in res) { setError(res.error); return; }
      setResults(res.lines);
      // Quedan en pantalla solo las que fallaron, para corregirlas.
      setRows((rs) => rs.filter((_, i) => !res.lines[i]?.ok));
      if (res.lines.every((l) => l.ok)) setText("");
    });

  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold text-slate-900">🎤 Registrar por voz</summary>
      <div className="mt-3 space-y-4">
        <p className="muted">Dicta lo que entró o salió, por ejemplo: «entraron diez cajas de guantes de nitrilo que vencen en marzo de 2028 y dos cajas de lidocaína que vencen en agosto de 2027», o «salieron tres carpules de lidocaína». Primero verás una lista para revisar; nada se guarda hasta que confirmes.</p>
        <div className="flex flex-wrap items-start gap-2">
          <VoiceButton onPhrase={(p) => setText((t) => `${t} ${p}`.trim())} onInterim={setInterim} label="🎤 Dictar" />
          <button type="button" onClick={() => build(text)} disabled={!text.trim()} className="btn-primary min-h-11">Armar la lista</button>
          {(text || rows.length > 0) && <button type="button" onClick={() => { setText(""); setRows([]); setResults([]); setError(undefined); setInterim(""); }} className="btn-secondary min-h-11">Borrar</button>}
        </div>
        <label className="label">Lo que dijiste (puedes corregirlo o escribirlo)
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="field" placeholder="Entraron dos cajas de…" />
        </label>
        {interim && <p className="muted">Oyendo: {interim}</p>}
        {error && <p role="alert" className="error-text">{error}</p>}

        {rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((r) => {
              const it = r.itemId ? byId.get(r.itemId) : null;
              const pr = problem(r);
              return (
                <li key={r.id} className={`rounded-lg border p-3 ${pr ? "border-amber-500 bg-amber-50" : "border-green-600 bg-green-50"}`}>
                  <p className="muted mb-2">Oí: «{r.heard}»</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="label">Movimiento
                      <select value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value as "IN" | "OUT" })} className="field">
                        <option value="IN">Ingreso (entró)</option>
                        <option value="OUT">Salida (se gastó)</option>
                      </select>
                    </label>
                    <label className="label">Producto
                      <select value={r.itemId ?? ""} onChange={(e) => patch(r.id, { itemId: e.target.value || null, inPack: false })} className="field">
                        <option value="">Selecciona…</option>
                        {r.candidates.length > 0 && <optgroup label="Posibles">{r.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
                        <optgroup label="Todos">{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
                      </select>
                    </label>
                    <div className="label">
                      <span>Cantidad</span>
                      <div className="flex gap-2">
                        <input type="number" inputMode="numeric" min={1} value={r.quantity || ""} onChange={(e) => patch(r.id, { quantity: Number(e.target.value) })} aria-label="Cantidad" className="field min-w-0 flex-1" />
                        {it?.packLabel && it.packSize ? (
                          <select value={r.inPack ? "pack" : "unit"} onChange={(e) => patch(r.id, { inPack: e.target.value === "pack" })} aria-label="Unidad" className="field w-auto shrink-0">
                            <option value="unit">{unitLabel(it.unit, 2)}</option>
                            <option value="pack">{unitLabel(it.packLabel, 2)} de {it.packSize}</option>
                          </select>
                        ) : it ? <span className="self-center text-sm text-slate-800">{unitLabel(it.unit, r.quantity || 2)}</span> : null}
                      </div>
                    </div>
                    {r.kind === "IN" && (
                      <label className="label">{it?.perishable === false ? "Vence (opcional)" : "Vence"}
                        <input type="date" value={r.expiresAt} onChange={(e) => patch(r.id, { expiresAt: e.target.value })} className="field" />
                      </label>
                    )}
                  </div>
                  {r.warnings.filter((w) => !(w === "Elige el producto" && it) && !(w === "No oí la cantidad" && r.quantity)).map((w) => <p key={w} className="mt-2 text-sm font-semibold text-amber-900">⚠ {w}</p>)}
                  {pr && <p className="mt-1 text-sm font-semibold text-amber-900">Falta para guardar: {pr.toLowerCase()}</p>}
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="mt-2 min-h-11 text-sm font-semibold text-red-800 underline">Quitar esta línea</button>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > 0 && <button type="button" onClick={confirm} disabled={!ready || pending} className="btn-primary min-h-11 w-full sm:w-auto">{pending ? "Guardando…" : `Confirmar ${rows.length} línea${rows.length === 1 ? "" : "s"}`}</button>}

        {results.length > 0 && (
          <ul className="space-y-1 text-sm">
            {results.map((r, i) => <li key={i} className={r.ok ? "ok-text" : "error-text"}>{r.ok ? "✓" : "✗"} {r.text}</li>)}
          </ul>
        )}
      </div>
    </details>
  );
}
