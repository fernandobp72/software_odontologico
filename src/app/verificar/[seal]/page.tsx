import type { Metadata } from "next";
import { SEAL_LABEL, verifySeal } from "@/lib/seal";

export const metadata: Metadata = { title: "Verificar documento", robots: { index: false, follow: false } };

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

// Verificación pública del sello de un documento firmado. No muestra datos del paciente.
export default async function VerificarPage({ params }: PageProps<"/verificar/[seal]">) {
  const { seal } = await params;
  const r = await verifySeal(seal.toLowerCase());
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold text-slate-900">Verificación de documento</h1>
      {!r && (
        <div role="alert" className="card border-red-300">
          <p className="font-semibold text-red-800">Este sello no corresponde a ningún documento.</p>
          <p className="muted mt-1">Revisa que el código esté completo. Si el documento es impreso y no se puede verificar, desconfía de él.</p>
        </div>
      )}
      {r && r.intact && (
        <div className="card border-green-300">
          <p className="font-semibold text-green-800">✓ Documento auténtico: su contenido no ha sido modificado desde que se firmó.</p>
          {r.voided && <p className="mt-1 font-semibold text-red-700">Atención: esta fórmula fue ANULADA por el profesional.</p>}
        </div>
      )}
      {r && !r.intact && (
        <div role="alert" className="card border-red-300">
          <p className="font-semibold text-red-800">⚠ El contenido de este documento cambió después de firmarse. No lo uses como válido.</p>
        </div>
      )}
      {r && (
        <dl className="card space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>Documento</dt><dd className="font-semibold">{SEAL_LABEL[r.kind]}{r.number ? ` N.º ${r.number}` : ""}</dd></div>
          <div className="flex justify-between gap-4"><dt>Firmado</dt><dd className="font-semibold">{fmt.format(r.signedAt)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Profesional</dt><dd className="font-semibold">{r.signer}</dd></div>
          <div className="flex justify-between gap-4"><dt>Registro</dt><dd className="font-semibold">{r.license ?? "—"}</dd></div>
          <div className="flex justify-between gap-4"><dt>Consultorio</dt><dd className="font-semibold">{r.clinic}</dd></div>
        </dl>
      )}
      {r?.pro?.present && (
        <div className={`card ${r.pro.valid ? (r.pro.compromised ? "border-amber-600" : "border-green-300") : "border-red-300"}`}>
          {r.pro.valid && !r.pro.compromised && <p className="font-semibold text-green-800">✓ Firmado con el sello digital del profesional{r.pro.method === "PASSKEY" ? ": la prueba criptográfica de su dispositivo es válida" : " (clave de firma)"}.</p>}
          {r.pro.valid && r.pro.compromised && <p className="font-semibold text-amber-900">⚠ Firmado con un dispositivo que el profesional reportó como perdido o robado. Documento en revisión.</p>}
          {!r.pro.valid && <p role="alert" className="font-semibold text-red-800">⚠ La firma del profesional NO coincide con el contenido actual.</p>}
          <p className="muted mt-1">Dispositivo N.º {r.pro.serial ?? "—"}{r.pro.generation ? ` · sello reexpedido ${r.pro.generation} vez` : ""}{r.pro.revoked && !r.pro.compromised ? " · ese dispositivo se retiró después de esta firma" : ""}</p>
        </div>
      )}
      {r && r.pro && !r.pro.present && <p className="muted">Este documento se firmó con la sesión del profesional, sin sello de dispositivo.</p>}
      <p className="muted">El sello prueba que el contenido no cambió desde la firma. No reemplaza una firma digital certificada.</p>
    </main>
  );
}
