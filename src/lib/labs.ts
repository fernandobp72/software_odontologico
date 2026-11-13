// Laboratorio dental: estados y textos en palabras de consultorio.
export const LAB_STATUS = {
  SENT: { label: "Enviado", cls: "bg-blue-100 text-blue-900" },
  ADJUST: { label: "Devuelto para ajuste", cls: "bg-amber-100 text-amber-900" },
  RECEIVED: { label: "Recibido", cls: "bg-teal-100 text-teal-900" },
  PLACED: { label: "Colocado", cls: "bg-green-100 text-green-900" },
} as const;
export type LabStatus = keyof typeof LAB_STATUS;
export const labStatus = (s: string) => LAB_STATUS[s as LabStatus] ?? { label: s, cls: "bg-slate-200 text-slate-900" };
// El trabajo todavía no está en el consultorio.
export const OUTSIDE: LabStatus[] = ["SENT", "ADJUST"];

// Quién asume el costo de una repetición.
export const REDO_PAYER = { LAB: "El laboratorio (no se cobra)", CLINIC: "La clínica", PRO: "El profesional (se descuenta en su liquidación)" } as const;
export type RedoPayer = keyof typeof REDO_PAYER;

export const WORK_TYPES = ["Corona", "Incrustación", "Carilla", "Puente", "Prótesis total", "Prótesis parcial removible", "Placa miorrelajante", "Guarda", "Retenedor", "Núcleo", "Modelo de estudio", "Otro"];
