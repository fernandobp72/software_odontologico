"use client";

import { useEffect, useState } from "react";

// Botón de envío en dos pasos para acciones que borran, cancelan o no tienen vuelta atrás:
// el primer toque pide confirmar y el segundo envía. Si no se confirma en unos segundos, vuelve a su estado normal.
export default function ConfirmButton({ children, confirmLabel, className = "btn-danger", confirmClassName = "btn-danger", pendingLabel }: { children: React.ReactNode; confirmLabel: string; className?: string; confirmClassName?: string; pendingLabel?: string }) {
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 6000);
    return () => clearTimeout(t);
  }, [asking]);

  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className={className}>{children}</button>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar acción">
      <button type="submit" autoFocus onClick={() => setSent(true)} className={`${confirmClassName} font-bold`} aria-live="polite">{sent && pendingLabel ? pendingLabel : confirmLabel}</button>
      <button type="button" onClick={() => setAsking(false)} className="btn-secondary">No</button>
    </span>
  );
}
