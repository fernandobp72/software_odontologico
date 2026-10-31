"use client";

import { useState, useTransition } from "react";
import { voidPrescription } from "./actions";

export default function VoidButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button type="button" disabled={pending} className="btn-danger min-h-10" onClick={() => {
        const why = window.prompt("Motivo de la anulación (queda registrado):");
        if (!why) return;
        start(async () => { const r = await voidPrescription(id, why); setError(r?.error); });
      }}>Anular</button>
      {error && <p role="alert" className="error-text">{error}</p>}
    </div>
  );
}
