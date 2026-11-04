"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Pt = { x: number; y: number };
type Stroke = Pt[];

// Firma en pantalla grande: el recuadro de la página solo muestra la firma; al tocarlo se abre un panel que ocupa casi toda la
// pantalla (en el celular se puede girar para tener más espacio). Los trazos se guardan como puntos y se vuelven a dibujar al
// girar o cambiar el tamaño, así lo escrito nunca se desplaza. Deja el PNG recortado en un input oculto.
export default function SignaturePad({ name }: { name: string }) {
  const [data, setData] = useState(""); // PNG de la firma (controlado: React 19 limpia los campos tras una acción con error)
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label">Firma de quien consiente</span>
        {data && <button type="button" onClick={() => setData("")} className="btn-secondary min-h-10">Borrar firma</button>}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={data ? "Cambiar la firma" : "Abrir el área de firma"}
        className="mt-2 flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-500 bg-white text-slate-800 hover:bg-slate-50"
      >
        {data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data} alt="Firma dibujada" className="max-h-full max-w-full object-contain p-2" />
        ) : (
          <span className="px-4 text-center font-semibold">✍ Toca aquí para firmar<span className="muted block font-normal">Se abre en pantalla grande</span></span>
        )}
      </button>
      <input type="hidden" name={name} value={data} readOnly />
      {open && <SignOverlay onCancel={() => setOpen(false)} onDone={(png) => { setData(png); setOpen(false); }} />}
    </div>
  );
}

function SignOverlay({ onCancel, onDone }: { onCancel: () => void; onDone: (png: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]); // en píxeles CSS del lienzo en el tamaño `base`
  const base = useRef({ w: 0, h: 0 });
  const current = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const [empty, setEmpty] = useState(true);
  const pushed = useRef(false);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * ratio) || c.height !== Math.round(h * ratio)) { c.width = Math.round(w * ratio); c.height = Math.round(h * ratio); }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Línea guía donde se firma
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(w * 0.06, h * 0.72); ctx.lineTo(w * 0.94, h * 0.72); ctx.stroke(); ctx.setLineDash([]);
    // Los trazos se escalan parejo (sin deformarse) y se centran si cambia la forma del lienzo.
    const b = base.current;
    const s = b.w ? Math.min(w / b.w, h / b.h) : 1;
    const ox = b.w ? (w - b.w * s) / 2 : 0, oy = b.w ? (h - b.h * s) / 2 : 0;
    ctx.strokeStyle = "#0f172a"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3;
    for (const st of strokes.current) {
      if (!st.length) continue;
      ctx.beginPath();
      const p = (q: Pt) => ({ x: ox + q.x * s, y: oy + q.y * s });
      let a = p(st[0]);
      ctx.moveTo(a.x, a.y);
      if (st.length === 1) ctx.lineTo(a.x + 0.1, a.y);
      // Curvas suaves por los puntos medios: la letra pegada se ve continua, no quebrada.
      for (let i = 1; i < st.length; i++) {
        const bpt = p(st[i]);
        ctx.quadraticCurveTo(a.x, a.y, (a.x + bpt.x) / 2, (a.y + bpt.y) / 2);
        a = bpt;
      }
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
    }
  }, []);

  // Tamaño inicial, giro del celular y cambios de ventana: se vuelve a dibujar, no se pierde ni se desplaza nada.
  useEffect(() => {
    const el = wrap.current!;
    const c = canvas.current!;
    base.current = { w: c.clientWidth, h: c.clientHeight };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  // Bloquea el desplazamiento de la página y la selección de texto mientras se firma; atrás cierra el panel.
  const cancel = useRef(onCancel);
  useEffect(() => { cancel.current = onCancel; });
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const stop = (e: Event) => e.preventDefault();
    const el = wrap.current!, c = canvas.current!;
    // Escuchas nativas no pasivas: React registra las suyas como pasivas y no pueden impedir el gesto del navegador.
    // El bloqueo del toque va solo en el lienzo: en los botones haría que no respondan.
    const onWrap = ["selectstart", "contextmenu", "dblclick", "gesturestart"];
    const onCanvas = ["touchstart", "touchmove"];
    for (const t of onWrap) el.addEventListener(t, stop, { passive: false });
    for (const t of onCanvas) c.addEventListener(t, stop, { passive: false });
    history.pushState({ signing: true }, "");
    pushed.current = true;
    const onPop = () => { pushed.current = false; cancel.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      document.body.style.overflow = overflow;
      for (const t of onWrap) el.removeEventListener(t, stop);
      for (const t of onCanvas) c.removeEventListener(t, stop);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const close = () => { if (pushed.current) { pushed.current = false; history.back(); } else onCancel(); };

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    e.preventDefault();
    activePointer.current = e.pointerId;
    canvas.current!.setPointerCapture(e.pointerId);
    // El primer trazo fija el tamaño de referencia; los siguientes se miden contra él.
    if (!strokes.current.length) base.current = { w: canvas.current!.clientWidth, h: canvas.current!.clientHeight };
    const b = base.current, c = canvas.current!;
    const s = Math.min(c.clientWidth / b.w, c.clientHeight / b.h);
    const ox = (c.clientWidth - b.w * s) / 2, oy = (c.clientHeight - b.h * s) / 2;
    const raw = at(e);
    // Se guarda en las coordenadas de referencia para que redibujar con otro tamaño sea exacto.
    const pt = { x: (raw.x - ox) / s, y: (raw.y - oy) / s };
    current.current = [pt];
    strokes.current.push(current.current);
    setEmpty(false);
    draw();
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current || !current.current) return;
    e.preventDefault();
    const b = base.current, c = canvas.current!;
    const s = Math.min(c.clientWidth / b.w, c.clientHeight / b.h);
    const ox = (c.clientWidth - b.w * s) / 2, oy = (c.clientHeight - b.h * s) / 2;
    // Los navegadores agrupan movimientos: se toman todos para no perder curvas rápidas.
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent as PointerEvent];
    const r = c.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent as PointerEvent]) current.current.push({ x: (ev.clientX - r.left - ox) / s, y: (ev.clientY - r.top - oy) / s });
    draw();
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    current.current = null;
  };

  const clear = () => { strokes.current = []; current.current = null; base.current = { w: canvas.current!.clientWidth, h: canvas.current!.clientHeight }; setEmpty(true); draw(); };

  // PNG recortado a la firma (con margen) y de tamaño moderado, sobre fondo blanco.
  const finish = () => {
    const pts = strokes.current.flat();
    if (!pts.length) return;
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const pad = 12, bw = Math.max(maxX - minX, 1) + pad * 2, bh = Math.max(maxY - minY, 1) + pad * 2;
    const k = Math.min(1, 900 / bw, 340 / bh) * 2; // 2x para que se vea nítida al imprimir
    const out = document.createElement("canvas");
    out.width = Math.max(Math.round(bw * k), 40); out.height = Math.max(Math.round(bh * k), 40);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.strokeStyle = "#0f172a"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3 * k;
    for (const st of strokes.current) {
      const p = (q: Pt) => ({ x: (q.x - minX + pad) * k, y: (q.y - minY + pad) * k });
      let a = p(st[0]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (st.length === 1) ctx.lineTo(a.x + 0.1, a.y);
      for (let i = 1; i < st.length; i++) { const b = p(st[i]); ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); a = b; }
      ctx.lineTo(a.x, a.y); ctx.stroke();
    }
    onDone(out.toDataURL("image/png"));
  };

  return (
    <div ref={wrap} role="dialog" aria-modal="true" aria-label="Área de firma" className="fixed inset-0 z-50 flex select-none flex-col bg-white [-webkit-touch-callout:none] [-webkit-user-select:none] [overscroll-behavior:contain]" style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-300 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} className="btn-secondary min-h-11">✕ Cancelar</button>
        <button type="button" onClick={clear} disabled={empty} className="btn-secondary min-h-11">Borrar</button>
        <button type="button" onClick={finish} disabled={empty} className="btn-primary min-h-11">✓ Listo</button>
      </div>
      <p className="px-3 py-1 text-center text-sm text-slate-700">Firma sobre la línea. Puedes girar el celular para tener más espacio.</p>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Lienzo de firma"
        className="m-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] min-h-0 flex-1 rounded-lg border-2 border-dashed border-slate-500 bg-white"
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
      />
    </div>
  );
}
