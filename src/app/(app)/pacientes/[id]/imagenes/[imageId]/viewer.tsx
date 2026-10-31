"use client";

import { useState } from "react";

// Visor con zoom, brillo, contraste e inversión para leer radiografías. No altera el archivo guardado.
export default function Viewer({ src, alt, isPdf }: { src: string; alt: string; isPdf: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);

  if (isPdf) return <iframe src={src} title={alt} className="h-[75vh] w-full rounded-lg border border-slate-300 bg-white" />;

  const reset = () => { setZoom(1); setBrightness(100); setContrast(100); setInvert(false); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1" role="group" aria-label="Zoom">
          <button type="button" className="btn-secondary min-h-10 px-3" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Alejar">−</button>
          <span className="flex min-w-14 items-center justify-center text-sm font-semibold text-slate-900">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-secondary min-h-10 px-3" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} aria-label="Acercar">+</button>
        </div>
        <label className="label min-w-32 flex-1">Brillo<input type="range" min={40} max={200} value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="mt-2 w-full accent-teal-700" /></label>
        <label className="label min-w-32 flex-1">Contraste<input type="range" min={40} max={250} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="mt-2 w-full accent-teal-700" /></label>
        <button type="button" aria-pressed={invert} onClick={() => setInvert((v) => !v)} className={invert ? "btn bg-teal-100 text-teal-900" : "btn-secondary"}>Invertir</button>
        <button type="button" className="btn-secondary" onClick={reset}>Restablecer</button>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-lg bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{ width: `${zoom * 100}%`, maxWidth: "none", filter: `brightness(${brightness}%) contrast(${contrast}%)${invert ? " invert(1)" : ""}` }}
          className="mx-auto block"
        />
      </div>
    </div>
  );
}
