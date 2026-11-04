"use client";

import { useActionState } from "react";
import { unlockConstancia } from "./actions";

export default function UnlockForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unlockConstancia.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-sm">Por seguridad, escribe los <strong>últimos 4 dígitos del documento de quien firmó</strong> para ver la constancia.</p>
      <label className="label">Últimos 4 dígitos<input name="last4" inputMode="numeric" autoComplete="off" maxLength={8} required className="field text-center text-lg tracking-widest" /></label>
      {state?.error && <p role="alert" className="error-text text-center">{state.error}</p>}
      <button disabled={pending} className="btn-primary min-h-11 w-full">{pending ? "Verificando…" : "Ver constancia"}</button>
    </form>
  );
}
