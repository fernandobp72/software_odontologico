"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Pantalla de error en español con «Intentar de nuevo» y «Volver», en lugar de la página genérica del sistema.
export default function ErrorView({ error, retry, home = "/agenda" }: { error: unknown; retry: () => void; home?: string }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    console.error(error);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 py-8">
      <h1 className="page-title">{offline ? "No hay conexión a internet" : "Algo salió mal"}</h1>
      <p className="text-slate-800">
        {offline
          ? "Revisa la señal o el wifi y vuelve a intentarlo. Lo que estabas escribiendo en una evolución queda guardado en este aparato."
          : "No pudimos mostrar esta pantalla. Puedes intentarlo de nuevo; si sigue pasando, avísale a soporte."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary">Intentar de nuevo</button>
        <Link href={home} className="btn-secondary">Volver al inicio</Link>
      </div>
      {digest && <p className="muted">Código para soporte: {digest}</p>}
    </div>
  );
}
