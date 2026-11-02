// Sello de integridad de un documento firmado: enlaza a la verificación pública. Los anteriores a esta función no lo tienen.
export default function SealMark({ seal, full = false }: { seal: string | null; full?: boolean }) {
  if (!seal) return <span className="text-xs text-slate-600">Sin sello de integridad (firmado antes de esta función)</span>;
  return (
    <a href={`/verificar/${seal}`} target="_blank" rel="noopener" className="text-xs font-semibold text-teal-800 underline">
      ✓ Sello {full ? seal.slice(0, 32).toUpperCase().match(/.{8}/g)!.join("-") : seal.slice(0, 8).toUpperCase()}
    </a>
  );
}
