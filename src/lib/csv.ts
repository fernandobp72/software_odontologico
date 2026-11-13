// Archivos que abren en Excel en español: punto y coma, BOM para las tildes y sin fórmulas.
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita que Excel lo tome como fórmula
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
// Fecha y hora de Colombia como «2026-11-13 14:05», que Excel ordena bien.
export const stamp = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
export const csvResponse = (body: string, filename: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
