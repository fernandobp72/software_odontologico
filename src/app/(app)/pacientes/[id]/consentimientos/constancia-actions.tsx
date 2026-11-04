"use client";

import { useState, useTransition } from "react";
import { sendConstancia, type ConstanciaResult } from "./actions";

export default function ConstanciaActions({ consentId, hasEmail, hasPhone }: { consentId: string; hasEmail: boolean; hasPhone: boolean }) {
  const [msg, setMsg] = useState<ConstanciaResult>();
  const [pending, start] = useTransition();
  const run = (channel: "correo" | "whatsapp" | "enlace") =>
    start(async () => {
      const r = (await sendConstancia(consentId, channel)) ?? {};
      setMsg(r);
      if (r.whatsapp) window.open(r.whatsapp, "_blank", "noopener");
      if (r.link) try { await navigator.clipboard.writeText(r.link); setMsg({ ...r, ok: "Enlace copiado" }); } catch { /* queda visible abajo */ }
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !hasEmail} onClick={() => run("correo")} title={hasEmail ? "" : "El paciente no tiene correo"} className="btn-secondary min-h-11">Enviar por correo</button>
        <button type="button" disabled={pending || !hasPhone} onClick={() => run("whatsapp")} title={hasPhone ? "" : "El paciente no tiene celular válido"} className="btn-secondary min-h-11">WhatsApp</button>
        <button type="button" disabled={pending} onClick={() => run("enlace")} className="btn-secondary min-h-11">Copiar enlace</button>
      </div>
      {msg?.error && <p role="alert" className="error-text">{msg.error}</p>}
      {msg?.ok && <p className="ok-text">{msg.ok}</p>}
      {msg?.link && <input readOnly value={msg.link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de la constancia" className="field text-xs" />}
    </div>
  );
}
