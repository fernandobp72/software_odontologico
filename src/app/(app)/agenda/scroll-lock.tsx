"use client";

import { useEffect } from "react";

// Evita que la página de fondo se desplace mientras la hoja del día está abierta (solo en pantallas sin panel lateral).
export default function ScrollLock() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1279px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return null;
}
