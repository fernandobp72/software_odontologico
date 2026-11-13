"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import ConfirmButton from "@/app/confirm-button";
import { CATEGORIES, DOC_KINDS, MAX_SUPPORT, SOURCES, addDays, needsReview, type CategoryKey, type SourceKey } from "@/lib/finanzas";
import { createExpense, payExpense, updatePayee, voidExpense, voidExpensePayment, type PayState } from "./actions";

// Reduce la foto en el dispositivo: la factura se lee igual y sube rápido desde el celular.
async function shrinkPhoto(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.8));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export type PayeeOption = { name: string; category: string | null };
export type RecurringPrefill = { id: string; period: string; payee: string; category: string; amount: number; description: string | null; dueDate: string };

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`}>{children}</button>
);

export function ExpenseForm({ admin, today, payees, sources, prefill, hasOpenCash }: { admin: boolean; today: string; payees: PayeeOption[]; sources: SourceKey[]; prefill?: RecurringPrefill; hasOpenCash: boolean }) {
  const [state, action, pending] = useActionState(createExpense, undefined);
  const form = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"PAID" | "OWED">("PAID");
  const [source, setSource] = useState<SourceKey>(sources.includes("BANK") ? "BANK" : sources[0]);
  const [category, setCategory] = useState<string>(prefill?.category ?? "");
  const [due, setDue] = useState(prefill?.dueDate ?? addDays(today, 15));
  const [docKind, setDocKind] = useState("NONE");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [fileName, setFileName] = useState<string>();

  // Al elegir a quién se le paga, se sugiere la categoría que se usó la última vez.
  function onPayee(name: string) {
    const p = payees.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (p?.category && !category) setCategory(p.category);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(undefined);
    const fd = new FormData(e.currentTarget);
    const files = (fd.getAll("source_file") as File[]).filter((f) => f.size > 0);
    fd.delete("source_file");
    if (files[0]) {
      setBusy(true);
      try {
        const f = files[0].type.startsWith("image/") ? await shrinkPhoto(files[0]) : files[0];
        if (f.size > MAX_SUPPORT) {
          setLocalError("El archivo pesa más de 900 KB. Toma una foto de la factura en lugar del PDF.");
          return;
        }
        fd.set("file", f);
      } catch {
        setLocalError("No se pudo leer el archivo. Intenta con una foto.");
        return;
      } finally {
        setBusy(false);
      }
    }
    startTransition(() => action(fd));
  }

  const done = state?.ok && state.expenseId;
  if (done) {
    return (
      <div className="card space-y-3 border-teal-700">
        <p className="ok-text text-base">Gasto guardado.</p>
        {state.warning && <p role="alert" className="error-text">{state.warning}</p>}
        <div className="flex flex-wrap gap-2">
          {admin && <Link href={`/finanzas/gastos/${state.expenseId}`} className="btn-secondary">Ver el gasto</Link>}
          {prefill ? <Link href="/finanzas" className="btn-primary">Volver al resumen</Link> : <button type="button" onClick={() => location.reload()} className="btn-primary">Registrar otro</button>}
        </div>
      </div>
    );
  }

  const busyOrPending = busy || pending;
  return (
    <form ref={form} onSubmit={submit} className="card space-y-4">
      <h2 className="section-title">{prefill ? `Registrar ${prefill.payee}` : "Nuevo gasto"}</h2>
      {prefill && <><input type="hidden" name="recurringId" value={prefill.id} /><input type="hidden" name="period" value={prefill.period} /></>}

      <label className="label">Valor (COP)
        <input name="amount" type="number" min={1} step={1} required inputMode="numeric" defaultValue={prefill?.amount} className="field text-2xl font-bold" placeholder="0" />
      </label>

      <label className="label">¿A quién le pagas?
        <input name="payeeName" required minLength={2} maxLength={120} list="payees" defaultValue={prefill?.payee} readOnly={!!prefill} onChange={(e) => onPayee(e.target.value)} autoComplete="off" className="field" placeholder="Ej.: Dental Express, arrendador, EPM" />
        <datalist id="payees">{payees.map((p) => <option key={p.name} value={p.name} />)}</datalist>
      </label>

      <label className="label">Categoría
        <select name="category" required value={category} onChange={(e) => setCategory(e.target.value)} className="field">
          <option value="" disabled>Elige una</option>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map((k) => <option key={k} value={k}>{CATEGORIES[k]}</option>)}
        </select>
      </label>

      <label className="label">Foto de la factura o soporte (opcional)
        <input name="source_file" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFileName(e.target.files?.[0]?.name)} className="field file:mr-3 file:rounded file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-white" />
        {fileName && <span className="muted mt-1 block">Se adjuntará: {fileName}</span>}
      </label>

      {admin && (
        <fieldset className="space-y-2">
          <legend className="label">¿Ya lo pagaste?</legend>
          <div className="flex flex-wrap gap-2">
            <Chip active={status === "PAID"} onClick={() => setStatus("PAID")}>Ya lo pagué</Chip>
            <Chip active={status === "OWED"} onClick={() => setStatus("OWED")}>Lo debo</Chip>
          </div>
          <input type="hidden" name="status" value={status} />
        </fieldset>
      )}
      {!admin && <input type="hidden" name="status" value="PAID" />}

      {status === "PAID" ? (
        <fieldset className="space-y-2">
          <legend className="label">¿De dónde salió la plata?</legend>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => <Chip key={s} active={source === s} onClick={() => setSource(s)}>{SOURCES[s]}</Chip>)}
          </div>
          <input type="hidden" name="source" value={source} />
          {source === "CASH_BOX" && !hasOpenCash && <p className="error-text">No hay caja abierta en esta sede. Ábrela en Caja o elige otro origen.</p>}
          {source === "BANK" && <label className="label">Referencia de la transferencia (opcional)<input name="reference" maxLength={60} className="field" /></label>}
        </fieldset>
      ) : (
        <fieldset className="space-y-2">
          <legend className="label">¿Hasta cuándo hay plazo?</legend>
          <div className="flex flex-wrap gap-2">
            {[8, 15, 30].map((n) => <Chip key={n} active={due === addDays(today, n)} onClick={() => setDue(addDays(today, n))}>{n} días</Chip>)}
          </div>
          <input name="dueDate" type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} required aria-label="Fecha límite de pago" className="field" />
        </fieldset>
      )}

      <details className="rounded-lg border border-slate-300 px-3" open={!!prefill}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Más datos (opcional)</summary>
        <div className="space-y-3 pb-3">
          <label className="label">Qué se compró o pagó<input name="description" maxLength={200} defaultValue={prefill?.description ?? ""} className="field" placeholder="Ej.: guantes y eyectores" /></label>
          <label className="label">Fecha del gasto<input name="expenseDate" type="date" defaultValue={today} max={today} required className="field" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Tipo de soporte
              <select name="docKind" value={docKind} onChange={(e) => setDocKind(e.target.value)} className="field">{Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="label">Número del soporte<input name="docNumber" maxLength={40} className="field" /></label>
          </div>
          {needsReview(docKind) && docKind !== "NONE" && <p className="muted">Para revisar con tu contador: si el proveedor no da factura electrónica, puede hacer falta un documento soporte.</p>}
          {admin && !prefill && (
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800">
              <input type="checkbox" name="repeat" className="h-5 w-5" /> Se repite cada mes (arriendo, servicios, software)
            </label>
          )}
        </div>
      </details>

      {(localError || state?.error) && <p role="alert" className="error-text">{localError ?? state?.error}</p>}
      <button disabled={busyOrPending} className="btn-primary w-full text-base">{busy ? "Preparando la foto…" : pending ? "Guardando…" : "Guardar gasto"}</button>
    </form>
  );
}

export function PayForm({ expenseId, remaining, sources, hasOpenCash }: { expenseId: string; remaining: number; sources: SourceKey[]; hasOpenCash: boolean }) {
  const [state, action, pending] = useActionState<PayState, FormData>(payExpense.bind(null, expenseId), undefined);
  const [source, setSource] = useState<SourceKey>("BANK");
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Pagar o abonar</h2>
      <label className="label">Valor (COP)
        <input name="amount" type="number" min={1} max={remaining} step={1} required inputMode="numeric" defaultValue={remaining} className="field text-xl font-bold" />
      </label>
      <fieldset className="space-y-2">
        <legend className="label">¿De dónde sale la plata?</legend>
        <div className="flex flex-wrap gap-2">{sources.map((s) => <Chip key={s} active={source === s} onClick={() => setSource(s)}>{SOURCES[s]}</Chip>)}</div>
        <input type="hidden" name="source" value={source} />
        {source === "CASH_BOX" && !hasOpenCash && <p className="error-text">No hay caja abierta en esta sede.</p>}
      </fieldset>
      <label className="label">Referencia (opcional)<input name="reference" maxLength={60} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Pago registrado</p>}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">{pending ? "Guardando…" : "Registrar pago"}</button>
    </form>
  );
}

function VoidForm({ act, label }: { act: (s: PayState, fd: FormData) => Promise<PayState>; label: string }) {
  const [state, action] = useActionState(act, undefined);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold text-red-700">{label}</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="reason" required minLength={5} placeholder="Motivo" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
        <ConfirmButton confirmLabel="Sí, anular">Anular</ConfirmButton>
      </form>
      {state?.error && <p role="alert" className="error-text mt-1">{state.error}</p>}
    </details>
  );
}

export const VoidExpense = ({ id }: { id: string }) => <VoidForm act={voidExpense.bind(null, id)} label="Anular este gasto" />;
export const VoidExpensePayment = ({ id }: { id: string }) => <VoidForm act={voidExpensePayment.bind(null, id)} label="Anular este pago" />;

export function PayeeForm({ id, document, phone, bank, note }: { id: string; document: string | null; phone: string | null; bank: string | null; note: string | null }) {
  const [state, action, pending] = useActionState<PayState, FormData>(updatePayee.bind(null, id), undefined);
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="label">NIT o cédula<input name="document" defaultValue={document ?? ""} maxLength={30} className="field" /></label>
      <label className="label">Teléfono<input name="phone" defaultValue={phone ?? ""} maxLength={30} inputMode="tel" className="field" /></label>
      <label className="label sm:col-span-2">Dónde se le consigna (banco, cuenta, Nequi)<input name="bank" defaultValue={bank ?? ""} maxLength={120} className="field" /></label>
      <label className="label sm:col-span-2">Nota<input name="note" defaultValue={note ?? ""} maxLength={200} className="field" /></label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Guardar datos"}</button>
        {state?.ok && <span className="ok-text">Guardado</span>}
        {state?.error && <span role="alert" className="error-text">{state.error}</span>}
      </div>
    </form>
  );
}
