"use client";

import { useEffect, useRef, useState } from "react";

// Lienzo de firma con puntero (dedo, lápiz o mouse). Deja el PNG en un input oculto.
export default function SignaturePad({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  // Controlado: React 19 limpia los campos del formulario tras una acción, y así la firma dibujada no se pierde si hay un error.
  const [data, setData] = useState("");

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  function pos(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent) {
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEmpty(false);
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setData(canvas.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setData("");
    setEmpty(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label">Firma de quien consiente</span>
        <button type="button" onClick={clear} className="btn-secondary min-h-10">Borrar firma</button>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Área de firma"
        className="mt-2 h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-500 bg-white"
      />
      <input type="hidden" name={name} value={data} readOnly />
      {empty && <p className="muted mt-1">Firma con el dedo, el lápiz o el mouse dentro del recuadro.</p>}
    </div>
  );
}
