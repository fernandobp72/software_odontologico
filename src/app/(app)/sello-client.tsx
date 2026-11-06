"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { startAuthentication } from "@simplewebauthn/browser";

export type SignPrep =
  | { mode: "SESSION" }
  | { mode: "BLOCKED"; error: string }
  | { mode: "SELLO"; hash: string; passkey: { options: unknown; challengeId: string } | null; pin: boolean };

type Ask = { prep: Extract<SignPrep, { mode: "SELLO" }>; resolve: (r: { proof?: string; error?: string }) => void };

// Confirmación con el sello digital: huella/rostro del dispositivo o clave de firma. Devuelve el texto "proof" que recibe el servidor.
// Si el navegador no deja abrir la huella sola (Safari lo pide con un toque), el diálogo ofrece el botón.
export function useSello() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const confirm = useCallback(
    (prep: SignPrep | { error: string }): Promise<{ proof?: string; error?: string }> => {
      if (!("mode" in prep)) return Promise.resolve({ error: prep.error });
      if (prep.mode === "SESSION") return Promise.resolve({ proof: "" });
      if (prep.mode === "BLOCKED") return Promise.resolve({ error: prep.error });
      return new Promise((resolve) => setAsk({ prep, resolve }));
    },
    [],
  );
  // En un portal: el diálogo suele abrirse dentro de un formulario y los formularios no se pueden anidar.
  const dialog: ReactNode = ask
    ? createPortal(
        <SelloDialog
          ask={ask}
          onDone={(r) => {
            ask.resolve(r);
            setAsk(null);
          }}
        />,
        document.body,
      )
    : null;
  return { confirm, dialog };
}

function SelloDialog({ ask, onDone }: { ask: Ask; onDone: (r: { proof?: string; error?: string }) => void }) {
  const { passkey, pin } = ask.prep;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [usePin, setUsePin] = useState(!passkey);
  const [pinValue, setPinValue] = useState("");
  const started = useRef(false);

  const device = useCallback(async () => {
    if (!passkey) return;
    setBusy(true);
    setMsg("");
    try {
      const response = await startAuthentication({ optionsJSON: passkey.options as never });
      onDone({ proof: JSON.stringify({ kind: "PASSKEY", challengeId: passkey.challengeId, response }) });
    } catch (e) {
      setBusy(false);
      const name = (e as { name?: string }).name;
      setMsg(name === "NotAllowedError" ? "No se confirmó. Toca el botón para intentarlo otra vez." : "No se pudo usar este dispositivo. Usa otro o tu clave de firma.");
    }
  }, [passkey, onDone]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
     
    void device();
  }, [device]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Confirmar con tu sello" className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 p-3 sm:items-center">
      <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">Firma con tu sello digital</h2>
        {!usePin ? (
          <>
            <p className="text-sm text-slate-800">Confirma con la huella, el rostro o el PIN de tu dispositivo. Solo tú puedes hacerlo.</p>
            <button type="button" disabled={busy} onClick={device} className="btn-primary w-full">{busy ? "Esperando tu confirmación…" : "Confirmar con mi dispositivo"}</button>
            {pin && <button type="button" onClick={() => setUsePin(true)} className="btn-secondary w-full">Usar mi clave de firma</button>}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{6}$/.test(pinValue)) return setMsg("Son 6 números.");
              onDone({ proof: JSON.stringify({ kind: "PIN", pin: pinValue }) });
            }}
            className="space-y-3"
          >
            <label className="label">Clave de firma (6 números)
              <input autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} className="field text-center text-2xl tracking-[0.5em]" />
            </label>
            <button className="btn-primary w-full">Firmar</button>
            {passkey && <button type="button" onClick={() => setUsePin(false)} className="btn-secondary w-full">Usar mi dispositivo</button>}
          </form>
        )}
        {msg && <p role="alert" className="error-text">{msg}</p>}
        <button type="button" onClick={() => onDone({ error: "Firma cancelada." })} className="min-h-10 w-full text-sm font-semibold text-slate-700 underline">Cancelar</button>
      </div>
    </div>
  );
}
