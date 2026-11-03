"use client";

import { useActionState } from "react";
import { unlockReceipt } from "./actions";

export default function UnlockForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unlockReceipt.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-sm">Por seguridad, escribe los <strong>últimos 4 dígitos del documento del paciente</strong> para ver el recibo.</p>
      <label className="label">Últimos 4 dígitos<input name="last4" inputMode="numeric" autoComplete="off" maxLength={8} required className="field text-center text-lg tracking-widest" /></label>
      {state?.error && <p role="alert" className="error-text text-center">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full min-h-11">{pending ? "Verificando…" : "Ver recibo"}</button>
    </form>
  );
}
