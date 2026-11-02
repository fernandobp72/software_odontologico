"use client";

export default function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="btn-primary">{label}</button>;
}
