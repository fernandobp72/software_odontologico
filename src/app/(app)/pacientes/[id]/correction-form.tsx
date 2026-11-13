"use client";

import { useActionState, useState } from "react";
import { prepareEvolutionSign, signEvolution, type EvolutionState } from "./actions";
import { useSello } from "../../sello-client";
import VoiceButton from "./voice-button";
import { applyDictation } from "@/lib/dictation";

// Nota aclaratoria: la evolución firmada no se toca; quien corrige firma una nueva que queda ligada a ella, con su nombre y fecha.
export default function CorrectionForm({ patientId, evolutionId, author }: { patientId: string; evolutionId: string; author: string }) {
  const [note, setNote] = useState("");
  const { confirm, dialog } = useSello();
  const [state, action, pending] = useActionState(async (prev: EvolutionState, fd: FormData) => {
    const c = await confirm(await prepareEvolutionSign(fd));
    if (c.error) return { error: c.error };
    fd.set("proof", c.proof ?? "");
    const res = await signEvolution(prev, fd);
    if (res?.ok) setNote("");
    return res;
  }, undefined);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold text-teal-800">Corregir o aclarar</summary>
      <form action={action} className="mt-3 space-y-3">
        {dialog}
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="correctsId" value={evolutionId} />
        <input type="hidden" name="reason" value="Nota aclaratoria" />
        <p className="muted">La evolución de {author} no se modifica. Lo que escribas queda como nota aclaratoria firmada a tu nombre, ligada a ella.</p>
        <div className="flex items-center justify-between">
          <label htmlFor={`fix-${evolutionId}`} className="label">Qué se corrige o aclara</label>
          <VoiceButton label="🎤 Dictar" onPhrase={(t) => setNote((cur) => applyDictation(cur, t))} />
        </div>
        <textarea id={`fix-${evolutionId}`} name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="Ej. Donde dice diente 36 debe decir diente 46." />
        {state?.error && <p role="alert" className="error-text">{state.error}</p>}
        {state?.ok && <p role="status" className="ok-text">Nota aclaratoria firmada.</p>}
        <button disabled={pending} className="btn-secondary">{pending ? "Firmando…" : "Firmar nota aclaratoria"}</button>
      </form>
    </details>
  );
}
