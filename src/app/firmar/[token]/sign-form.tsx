"use client";

import { useState, useTransition } from "react";
import SignaturePad from "@/app/(app)/pacientes/[id]/consentimientos/signature-pad";
import { signAsPatient, type FirmarState } from "./actions";

export default function SignForm({ token, signerName }: { token: string; signerName: string }) {
  const [state, setState] = useState<FirmarState>();
  const [pending, start] = useTransition();
  // Se envía a mano (no con action=) para que un error no borre la casilla marcada ni la firma ya dibujada.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await signAsPatient(token, undefined, fd)));
      }}
      className="space-y-4"
    >
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-900">
        <input name="accept" type="checkbox" required className="mt-0.5 h-5 w-5 accent-teal-700" />
        He leído y entiendo este documento, y firmo como <strong>{signerName}</strong>.
      </label>
      <SignaturePad name="signature" />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary min-h-11 w-full">{pending ? "Guardando…" : "Firmar"}</button>
    </form>
  );
}
