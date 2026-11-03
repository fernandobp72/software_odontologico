"use client";

import { useState, useTransition } from "react";
import { emailReceipt, linkReceipt, revokeReceiptLink, whatsappReceipt, type ShareState } from "./actions";

export default function ShareButtons({ paymentId, hasPhone, email, hasLink }: { paymentId: string; hasPhone: boolean; email: string | null; hasLink: boolean }) {
  const [msg, setMsg] = useState<ShareState>();
  const [pending, start] = useTransition();
  const [active, setActive] = useState(hasLink);

  const run = (fn: (id: string) => Promise<ShareState>, after?: (r: NonNullable<ShareState>) => void) =>
    start(async () => {
      const r = (await fn(paymentId)) ?? {};
      setMsg(r);
      if (!r.error) setActive(fn !== revokeReceiptLink);
      after?.(r);
    });

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); setMsg({ ok: "Enlace copiado" }); } catch { setMsg({ ok: "Copia el enlace de abajo", link }); }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-900">Compartir con el paciente</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={pending || !hasPhone} onClick={() => run(whatsappReceipt, (r) => r.whatsapp && window.open(r.whatsapp, "_blank", "noopener"))} className="btn-secondary min-h-11" title={hasPhone ? "" : "El paciente no tiene celular"}>WhatsApp</button>
        <button type="button" disabled={pending || !email} onClick={() => run(emailReceipt)} className="btn-secondary min-h-11" title={email ? "" : "El paciente no tiene correo"}>Correo</button>
        <button type="button" disabled={pending} onClick={() => run(linkReceipt, (r) => r.link && void copy(r.link))} className="btn-secondary min-h-11">Copiar enlace</button>
      </div>
      {active && <button type="button" disabled={pending} onClick={() => run(revokeReceiptLink)} className="text-sm font-semibold text-red-800 underline">Revocar enlace compartido</button>}
      {(!hasPhone || !email) && <p className="muted">{!hasPhone && "Sin celular válido. "}{!email && "Sin correo. "}Se agregan en Editar paciente.</p>}
      {msg?.error && <p role="alert" className="error-text">{msg.error}</p>}
      {msg?.ok && <p className="ok-text">{msg.ok}</p>}
      {msg?.link && <input readOnly value={msg.link} onFocus={(e) => e.currentTarget.select()} className="field text-xs" aria-label="Enlace del recibo" />}
    </div>
  );
}
