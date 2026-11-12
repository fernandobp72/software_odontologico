"use client";

import { useEffect, useState } from "react";

// Franja que avisa cuando se cae el internet, para no firmar o cobrar creyendo que quedó guardado.
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="alert" className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      Sin conexión a internet. Lo que escribes en la evolución se guarda en este aparato; espera a tener señal para firmar, cobrar o guardar.
    </div>
  );
}
