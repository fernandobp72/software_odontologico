"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PatientOption } from "@/lib/patient-fields";
import { searchPatients } from "./patient-search";

// Buscador de paciente para formularios: se escribe nombre, documento o celular y se elige de la lista.
// Reemplaza las listas desplegables, que se quedaban cortas cuando el consultorio tiene muchos pacientes.
export default function PatientPicker({ name = "patientId", initial = null, withPre = false, label = "Paciente" }: { name?: string; initial?: PatientOption | null; withPre?: boolean; label?: string }) {
  const [picked, setPicked] = useState<PatientOption | null>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Busca 250 ms después de la última tecla; solo vale la respuesta de la última búsqueda.
  function onType(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    const term = value.trim();
    const mine = ++seq.current;
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await searchPatients(term, { withPre });
        if (mine === seq.current) { setResults(r); setActive(0); }
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
  }

  function choose(p: PatientOption) {
    setPicked(p);
    onType("");
  }

  if (picked) {
    return (
      <div className="label">
        <span>{label}</span>
        <input type="hidden" name={name} value={picked.id} />
        <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-teal-700 bg-teal-50 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">{picked.label}</span>
            <span className="block truncate text-xs font-normal text-slate-700">{picked.detail}</span>
          </span>
          <button type="button" onClick={() => { setPicked(null); setTimeout(() => inputRef.current?.focus(), 0); }} className="btn-secondary min-h-10 shrink-0 px-3">Cambiar</button>
        </div>
      </div>
    );
  }

  const open = q.trim().length >= 2;
  return (
    <div className="label">
      <label htmlFor={`${listId}-q`}>{label}</label>
      {/* Campo vacío y obligatorio para que el formulario no se envíe sin paciente elegido. */}
      <input type="text" name={name} value="" required onChange={() => {}} tabIndex={-1} aria-hidden="true" className="sr-only" onInvalid={(e) => { (e.target as HTMLInputElement).setCustomValidity("Busca y elige el paciente"); inputRef.current?.focus(); }} />
      <input
        ref={inputRef}
        id={`${listId}-q`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Nombre, documento o celular"
        value={q}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && results[active]) { e.preventDefault(); choose(results[active]); }
        }}
        className="field"
      />
      {open && (
        <ul id={listId} role="listbox" className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white font-normal shadow-sm">
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => choose(p)} onMouseEnter={() => setActive(i)} className={`block w-full px-3 py-2 text-left ${i === active ? "bg-teal-50" : ""}`}>
                <span className="block font-semibold text-slate-900">{p.label}</span>
                <span className="block text-xs text-slate-700">{p.detail}</span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-slate-700">Sin resultados</li>}
          {loading && results.length === 0 && <li className="px-3 py-2 text-sm text-slate-700">Buscando…</li>}
        </ul>
      )}
      {!open && <p className="muted mt-1 font-normal">Escribe al menos 2 letras o números.</p>}
    </div>
  );
}
