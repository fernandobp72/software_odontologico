"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { createPin, finishAddDevice, prepareAddProof, startAddDevice } from "./actions";
import { useSello } from "../../sello-client";

export function AddDevice({ first, hasGrant }: { first: boolean; hasGrant: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useSello();

  async function add() {
    setBusy(true);
    setMsg({});
    try {
      const c = await confirm(await prepareAddProof());
      if (c.error) return setMsg({ error: c.error });
      const s = await startAddDevice(password, c.proof);
      if ("error" in s) return setMsg({ error: s.error });
      let response;
      try {
        response = await startRegistration({ optionsJSON: s.options as never });
      } catch (e) {
        const n = (e as { name?: string }).name;
        return setMsg({ error: n === "InvalidStateError" ? "Este dispositivo ya está en tu sello." : n === "NotAllowedError" ? "No se confirmó en el dispositivo. Inténtalo otra vez." : "Este dispositivo o navegador no permite crear el sello. Prueba con otro o usa la clave de firma." });
      }
      const r = await finishAddDevice(s.challengeId, response, label);
      if (r.error) return setMsg({ error: r.error });
      setPassword("");
      setLabel("");
      setMsg({ ok: "Dispositivo agregado a tu sello." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card max-w-lg space-y-3">
      {dialog}
      <h2 className="section-title">{first ? "Crear mi sello con este dispositivo" : "Agregar otro dispositivo"}</h2>
      <p className="muted">Al confirmar, este celular o computador queda como una de tus «llaves». Te pedirá tu huella, rostro o PIN del aparato. Funciona también con una llave USB de seguridad.</p>
      {hasGrant && <p className="rounded-lg border border-teal-700 bg-teal-50 p-2 text-sm text-teal-900">El administrador autorizó un sello nuevo para ti.</p>}
      <label className="label">Nombre del dispositivo (opcional)<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Mi celular, PC del consultorio…" className="field" /></label>
      <label className="label">Tu contraseña (para confirmar que eres tú)<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
      {first && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-900">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 accent-teal-700" />
          <span>Entiendo que mi sello es personal: firma en mi nombre y tiene el mismo valor que mi firma en la historia clínica. No lo comparto, y si pierdo un dispositivo lo reporto de inmediato.</span>
        </label>
      )}
      {msg.error && <p role="alert" className="error-text">{msg.error}</p>}
      {msg.ok && <p role="status" className="ok-text">{msg.ok}</p>}
      <button type="button" disabled={busy || !password || (first && !accepted)} onClick={add} className="btn-primary">{busy ? "Esperando tu dispositivo…" : "Agregar este dispositivo"}</button>
    </section>
  );
}

export function PinForm({ first }: { first: boolean }) {
  const { confirm, dialog } = useSello();
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof createPin>> | undefined, fd: FormData) => {
    const c = await confirm(await prepareAddProof());
    if (c.error) return { error: c.error };
    fd.set("proof", c.proof ?? "");
    return createPin(prev, fd);
  }, undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card max-w-lg space-y-3">
      {dialog}
      <h2 className="section-title">Clave de firma (sin celular)</h2>
      <p className="muted">Para quien no tiene un dispositivo compatible: una clave de 6 números solo para firmar, distinta de tu contraseña. Es menos segura que la huella; se recomienda tener también un dispositivo.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Clave de firma<input name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="off" className="field" /></label>
        <label className="label">Repítela<input name="pin2" type="password" inputMode="numeric" maxLength={6} autoComplete="off" className="field" /></label>
      </div>
      <label className="label">Tu contraseña<input name="password" type="password" autoComplete="current-password" className="field" /></label>
      {first && <p className="muted">Al crearla aceptas que es personal y que firma en tu nombre.</p>}
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p role="status" className="ok-text">Clave de firma creada</p>}
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Crear clave de firma"}</button>
    </form>
  );
}
