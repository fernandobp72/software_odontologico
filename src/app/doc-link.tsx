"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Abre un documento imprimible (recibo, cuenta de cobro, fórmula) en un panel encima de la pantalla actual, sin ventana nueva.
// Se cierra con el botón, con Esc o con el gesto/botón de atrás del celular y del navegador. El enlace sigue funcionando
// (clic con botón central, copiar dirección) porque es un <a> normal.
export default function DocLink({ href, title, className, children }: { href: string; title: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const pushed = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    if (pushed.current) {
      pushed.current = false;
      history.back();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    history.pushState({ docPanel: true }, "");
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 sm:items-center sm:p-4" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex w-full flex-col overflow-hidden bg-white sm:h-[92dvh] sm:max-w-3xl sm:rounded-lg">
            <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <button type="button" onClick={close} className="btn-secondary min-h-11">✕ Cerrar</button>
              <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
              <button type="button" onClick={() => frame.current?.contentWindow?.print()} className="btn-primary min-h-11">Imprimir</button>
            </div>
            <iframe ref={frame} src={href} title={title} className="min-h-0 w-full flex-1 bg-white pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </>
  );
}
