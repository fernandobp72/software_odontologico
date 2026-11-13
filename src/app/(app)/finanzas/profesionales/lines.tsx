import { copFmt } from "@/lib/cartera";
import { fmtDate } from "@/lib/finanzas";
import type { ProLine } from "@/lib/pro-pay-data";

// Detalle de la cuenta de un profesional: cada procedimiento con lo pagado por el paciente, el laboratorio y su parte.
export default function ProLines({ lines, showAll = false }: { lines: ProLine[]; showAll?: boolean }) {
  const due = lines.filter((l) => l.due !== 0);
  const waiting = lines.filter((l) => l.due === 0 && l.collected < l.price);
  const list = showAll ? lines : [...due, ...waiting];
  if (!list.length) return <p className="card text-center text-slate-700">No hay procedimientos pendientes por liquidar.</p>;
  return (
    <ul className="space-y-2">
      {list.map((l) => (
        <li key={l.itemId} className="card space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="block font-semibold">{l.patientName}</span>
              <span className="muted">{l.description} · {fmtDate(l.doneAt)}</span>
            </span>
            <span className={`text-lg font-bold ${l.due < 0 ? "text-red-700" : l.due > 0 ? "text-teal-800" : "text-slate-500"}`}>{copFmt.format(l.due)}</span>
          </div>
          <p className="text-sm text-slate-700">
            Valor {copFmt.format(l.price)} · el paciente ha pagado {copFmt.format(l.collected)}
            {l.lab ? ` · laboratorio ${copFmt.format(l.lab)}` : ""}
            {l.paid ? ` · ya liquidado ${copFmt.format(l.paid)}` : ""}
          </p>
          {l.collected < l.price && <p className="text-sm font-semibold text-amber-800">Pendiente: el paciente debe {copFmt.format(l.price - l.collected)}. Se liquida cuando pague.</p>}
          {l.due < 0 && <p className="text-sm font-semibold text-red-700">Se descuenta: el paciente recibió una devolución o se anuló un pago.</p>}
        </li>
      ))}
    </ul>
  );
}
