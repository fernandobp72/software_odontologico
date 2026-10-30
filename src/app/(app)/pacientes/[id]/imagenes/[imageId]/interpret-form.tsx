"use client";

import { useActionState } from "react";
import { interpretImage } from "../actions";

export default function InterpretForm({ imageId }: { imageId: string }) {
  const [state, action, pending] = useActionState(interpretImage.bind(null, imageId), undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="label">Interpretación
        <textarea name="interpretation" rows={5} required minLength={10} className="field" placeholder="Hallazgos radiográficos, diagnóstico presuntivo y recomendaciones" />
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Firmar interpretación"}</button>
      <p className="muted">Se guarda una sola vez, con tu nombre y la fecha, y no se puede editar.</p>
    </form>
  );
}
