"use client";

import { useActionState, useState } from "react";
import { saveIconColor } from "./actions";

export default function IconForm({ clinicId, v, color, logoSize }: { clinicId: string; v: string; color: string | null; logoSize: { w: number; h: number } | null }) {
  const [state, action, pending] = useActionState(saveIconColor, undefined);
  const [auto, setAuto] = useState(!color);
  const [picked, setPicked] = useState(color ?? "#2a7a4b");
  const small = logoSize && Math.max(logoSize.w, logoSize.h) < 256;
  return (
    <section className="card max-w-xl space-y-4">
      <div>
        <h2 className="section-title">Ícono de la app</h2>
        <p className="muted">Así se verá la app en el celular o el computador de tu equipo al instalarla. Se arma sola con tu logo.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/icono/${clinicId}/192?v=${v}`} alt="Ícono de la app" className="h-24 w-24 rounded-2xl border border-slate-300 shadow-sm" />
        <div className="text-sm text-slate-800">
          {logoSize ? <p>Tu logo mide {logoSize.w}×{logoSize.h} px.{small ? " Es pequeño: el ícono puede verse borroso. Sube uno de al menos 512 px." : ""}</p> : <p>Aún no subes un logo: se usa un diente blanco sobre verde. Sube tu logo arriba y el ícono se actualiza.</p>}
        </div>
      </div>
      <form action={action} className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900">
          <input type="checkbox" name="auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-5 w-5 accent-teal-700" /> Color de fondo automático
        </label>
        {!auto && (
          <label className="label">Color de fondo del ícono
            <input name="color" type="color" value={picked} onChange={(e) => setPicked(e.target.value)} className="h-12 w-24 cursor-pointer rounded border border-slate-400 bg-white p-1" />
          </label>
        )}
        {state?.error && <p role="alert" className="error-text">{state.error}</p>}
        {state?.ok && <p className="ok-text">{state.ok}. La vista previa se actualiza al recargar.</p>}
        <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Guardando…" : "Guardar color"}</button>
      </form>
      <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
        <p className="font-semibold">Cómo instalarla en cada aparato</p>
        <p><strong>Importante:</strong> instálala con tu sesión ya abierta, no desde la pantalla de inicio de sesión; si no, queda con el ícono genérico.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Android (Chrome):</strong> menú ⋮ → «Instalar app» o «Añadir a la pantalla de inicio».</li>
          <li><strong>iPhone (Safari):</strong> botón Compartir → «Añadir a pantalla de inicio».</li>
          <li><strong>Computador (Chrome o Edge):</strong> el ícono de instalar al final de la barra de direcciones.</li>
        </ul>
        <p className="muted">Si cambias el logo o el color, en Android el ícono se actualiza en unos días; en iPhone hay que quitar la app e instalarla de nuevo.</p>
      </div>
    </section>
  );
}
