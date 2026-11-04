"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { saveIconColor } from "./actions";

export default function IconForm({ clinicId, v, color, logoSize, ownSize }: { clinicId: string; v: string; color: string | null; logoSize: { w: number; h: number } | null; ownSize: { w: number; h: number } | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<{ ok?: string; error?: string }>();
  const [state, action, pending] = useActionState(saveIconColor, undefined);
  const [auto, setAuto] = useState(!color);
  const [picked, setPicked] = useState(color ?? "#2a7a4b");
  const small = (ownSize ?? logoSize) && Math.max((ownSize ?? logoSize)!.w, (ownSize ?? logoSize)!.h) < 256;

  async function send(file: File) {
    setBusy(true); setUp(undefined);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await fetch("/api/clinica/icono", { method: "POST", body: fd });
      const j = (await res.json()) as { ok?: boolean; error?: string; width?: number; height?: number; square?: boolean };
      if (!res.ok || !j.ok) setUp({ error: j.error ?? "No se pudo subir el ícono" });
      else { setUp({ ok: j.square ? `Listo: ${j.width}×${j.height} px.` : `Listo, pero la imagen no es cuadrada (${j.width}×${j.height} px): se centró con margen. Lo ideal es una imagen cuadrada de 512×512 px.` }); router.refresh(); }
    } catch {
      setUp({ error: "Sin conexión. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    setBusy(true);
    await fetch("/api/clinica/icono", { method: "DELETE" });
    setBusy(false); setUp(undefined); router.refresh();
  }
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
          {ownSize ? <p>Usas un ícono propio de {ownSize.w}×{ownSize.h} px.{small ? " Es pequeño: puede verse borroso. Sube uno de al menos 512 px." : ""}</p> : logoSize ? <p>Tu logo mide {logoSize.w}×{logoSize.h} px.{small ? " Es pequeño: el ícono puede verse borroso. Sube uno de al menos 512 px." : ""}</p> : <p>Aún no subes un logo: se usa un diente blanco sobre verde. Sube tu logo arriba y el ícono se actualiza.</p>}
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-slate-300 p-3">
        <p className="text-sm font-semibold text-slate-900">Ícono propio (opcional)</p>
        <p className="muted">Si tu logo es largo o trae texto, se ve pequeño en el celular. Sube aquí una imagen <strong>cuadrada</strong> (por ejemplo solo tu símbolo, de 512×512 px) y la app usará esa. Los recibos y documentos siguen usando tu logo.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-primary min-h-11">{busy ? "Procesando…" : ownSize ? "Cambiar ícono" : "Subir ícono propio"}</button>
          {ownSize && <button type="button" disabled={busy} onClick={remove} className="btn-secondary min-h-11">Quitar y usar mi logo</button>}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
        {up?.ok && <p className="ok-text" role="status">{up.ok}</p>}
        {up?.error && <p className="error-text" role="alert">{up.error}</p>}
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
