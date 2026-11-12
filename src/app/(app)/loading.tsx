// Se muestra mientras abre cualquier sección: con señal lenta el usuario ve que la app está trabajando y no vuelve a tocar.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <div className="flex items-center gap-3 text-slate-700">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" aria-hidden="true" />
        <span className="text-sm font-semibold">Cargando…</span>
      </div>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" aria-hidden="true" />
      <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
    </div>
  );
}
