export const STATUS: Record<string, { label: string; cls: string; chip: string; dot: string }> = {
  SCHEDULED: { label: "Programada", cls: "bg-slate-200 text-slate-900", chip: "border-slate-400 bg-slate-100 text-slate-900", dot: "bg-slate-500" },
  CONFIRMED: { label: "Confirmada", cls: "bg-blue-100 text-blue-900", chip: "border-blue-500 bg-blue-50 text-blue-900", dot: "bg-blue-600" },
  ATTENDED: { label: "Atendida", cls: "bg-green-100 text-green-900", chip: "border-green-600 bg-green-50 text-green-900", dot: "bg-green-600" },
  CANCELLED: { label: "Cancelada", cls: "bg-red-100 text-red-900", chip: "border-red-400 bg-red-50 text-red-900 line-through", dot: "bg-red-500" },
  NO_SHOW: { label: "No asistió", cls: "bg-amber-100 text-amber-900", chip: "border-amber-500 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
};
