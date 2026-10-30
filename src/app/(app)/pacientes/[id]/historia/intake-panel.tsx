"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createIntakeLink, revokeIntakeLink } from "./actions";

export type IntakeInfo =
  | { kind: "none" }
  | { kind: "pending"; expires: string }
  | { kind: "submitted"; id: string; at: string; signer: string; reviewed: boolean };

// El profesional genera el enlace, lo manda por WhatsApp y luego carga las respuestas en la valoración.
export default function IntakePanel({ patientId, firstName, clinic, phone, info }: { patientId: string; firstName: string; clinic: string; phone: string | null; info: IntakeInfo }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(undefined);
    start(async () => {
      const r = await createIntakeLink(patientId);
      if (r.error || !r.token) return setError(r.error);
      setLink(`${window.location.origin}/formulario/${r.token}`);
    });
  }
  const message = link ? `Hola ${firstName}, para agilizar tu cita en ${clinic} por favor llena este formulario con tus antecedentes de salud (5 minutos): ${link}` : "";

  return (
    <section className="card space-y-3">
      <h2 className="section-title">Formulario previo del paciente</h2>
      {info.kind === "submitted" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-900">
            {info.reviewed ? "Respuestas ya cargadas en la valoración." : <strong>El paciente contestó el formulario.</strong>} Firmado por {info.signer} · {info.at}
          </p>
          {!info.reviewed && (
            <Link href={`/pacientes/${patientId}/historia?intake=${info.id}`} className="btn-primary inline-flex">Revisar y cargar en la valoración</Link>
          )}
        </div>
      )}
      {info.kind === "pending" && !link && <p className="muted">Hay un enlace enviado, vigente hasta {info.expires}. Aún no lo han contestado.</p>}
      {info.kind === "none" && !link && <p className="muted">Envía un enlace para que el paciente llene su anamnesis desde el celular antes de la cita.</p>}
      {link && (
        <div className="space-y-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="field" aria-label="Enlace del formulario" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch {} }}>{copied ? "Copiado" : "Copiar enlace"}</button>
            {phone && <a className="btn-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">Enviar por WhatsApp</a>}
          </div>
          <p className="muted">Este enlace solo se muestra ahora. Vence en 7 días y sirve para un solo envío.</p>
        </div>
      )}
      {error && <p role="alert" className="error-text">{error}</p>}
      {(
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={generate} className="btn-secondary">
            {pending ? "Generando…" : info.kind === "none" && !link ? "Crear enlace" : "Crear enlace nuevo"}
          </button>
          {info.kind === "pending" && !link && (
            <button type="button" className="btn-secondary" onClick={() => start(async () => { await revokeIntakeLink(patientId); })}>Anular enlace</button>
          )}
        </div>
      )}
    </section>
  );
}
