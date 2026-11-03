"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Dentro del panel flotante (iframe) el panel ya trae su propio botón de imprimir.
export default function PrintButton({ label = "Imprimir" }: { label?: string }) {
  const embedded = useSyncExternalStore(noop, () => window.self !== window.top, () => false);
  if (embedded) return null;
  return <button type="button" onClick={() => window.print()} className="btn-primary">{label}</button>;
}
