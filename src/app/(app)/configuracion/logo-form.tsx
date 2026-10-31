"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function LogoForm({ clinicId, version }: { clinicId: string; version: number | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();

  async function send(file: File) {
    setBusy(true);
    setMsg(undefined);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await fetch("/api/clinica/logo", { method: "POST", body: fd });
      const j = (await res.json()) as { ok?: boolean; error?: string; original?: number; optimized?: number; width?: number; height?: number };
      if (!res.ok || !j.ok) setMsg({ error: j.error ?? "No se pudo subir el logo" });
      else {
        setMsg({ ok: `Listo: de ${kb(j.original!)} pasó a ${kb(j.optimized!)} (${j.width}×${j.height} px)` });
        router.refresh();
      }
    } catch {
      setMsg({ error: "Sin conexión. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/clinica/logo", { method: "DELETE" });
    setBusy(false);
    setMsg(undefined);
    router.refresh();
  }

  return (
    <section className="card max-w-xl space-y-3">
      <h2 className="section-title">Logo</h2>
      <p className="muted">Sube tu logo en el formato que tengas (JPG, PNG, WebP, GIF, SVG…). Se optimiza solo: queda liviano y nítido para el menú, los recibos y las cuentas de cobro.</p>
      <div className="flex flex-wrap items-center gap-4">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/logo/${clinicId}?v=${version}`} alt="Logo actual" className="h-20 w-20 rounded-lg border border-slate-300 bg-white object-contain p-1" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-400 text-xs text-slate-600">Sin logo</div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="btn-primary" onClick={() => input.current?.click()}>{busy ? "Procesando…" : version ? "Cambiar logo" : "Subir logo"}</button>
          {version && <button type="button" disabled={busy} className="btn-secondary" onClick={remove}>Quitar</button>}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
      </div>
      {msg?.ok && <p className="ok-text" role="status">{msg.ok}</p>}
      {msg?.error && <p className="error-text" role="alert">{msg.error}</p>}
    </section>
  );
}
