"use client";

import { useState, useTransition } from "react";
import { markReminderSent, prepareManualReminder } from "./actions";

// Abre WhatsApp con el mensaje ya escrito y registra el envío.
export default function SendButton({ appointmentId, phone, text }: { appointmentId: string; phone: string; text: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function send() {
    start(async () => {
      const r = await prepareManualReminder(appointmentId);
      if (r.error || !r.token) return setError(r.error);
      const message = text.replace("__TOKEN__", r.token).replace("__ORIGIN__", window.location.origin);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      await markReminderSent(appointmentId);
    });
  }

  return (
    <div>
      <button type="button" onClick={send} disabled={pending} className="btn-primary min-h-10">{pending ? "Abriendo…" : "Enviar por WhatsApp"}</button>
      {error && <p role="alert" className="error-text mt-1">{error}</p>}
    </div>
  );
}
