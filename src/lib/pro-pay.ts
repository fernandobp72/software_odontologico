// Pagos a profesionales por porcentaje: reglas puras (sin base de datos) para poder probarlas y reutilizarlas.

export type Agreement = { percent: number; deductLab: boolean };

// Lo que le corresponde al profesional por un procedimiento, según lo que el paciente ya pagó de él.
// Ejemplo del acuerdo por defecto: corona de $1.000.000, laboratorio de $200.000, 40 % → $320.000 cuando está pagada completa.
// Si está pagada a medias, se gana en proporción a lo pagado.
export function earnedFor(price: number, collected: number, lab: number, a: Agreement) {
  if (price <= 0 || collected <= 0) return 0;
  const net = a.deductLab ? Math.max(0, price - lab) : price;
  return Math.round((a.percent / 100) * Math.min(collected, price) * (net / price));
}

// Reparte lo que pagó cada paciente entre sus procedimientos realizados, del más antiguo al más reciente
// (la misma regla de la cartera). Devuelve cuánto se ha recaudado de cada procedimiento.
export function allocate(items: { id: string; doneAt: Date; price: number }[], paid: number) {
  const out = new Map<string, number>();
  let left = Math.max(0, paid);
  for (const i of [...items].sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime() || a.id.localeCompare(b.id))) {
    const take = Math.min(left, i.price);
    out.set(i.id, take);
    left -= take;
  }
  return out;
}

export const agreementText = (name: string, a: Agreement) => `A ${name} le pago el ${a.percent} % de lo que el paciente ya pagó${a.deductLab ? ", después de descontar el laboratorio" : ""}.`;

// Retención sugerida sobre honorarios: solo una sugerencia editable. La tarifa la confirma el contador.
export const SUGGESTED_RETENTION = 0.11;
