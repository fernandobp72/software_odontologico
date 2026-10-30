// Redacta la nota de evolución a partir de los procedimientos que el odontólogo marcó como realizados.
// Solo usa datos que el sistema ya conoce (procedimiento, diente, superficies, material, diagnóstico):
// no inventa hechos clínicos como la anestesia o las complicaciones; esas frases las elige el profesional.
import { CIE10 } from "./catalogs";

export type DoneItem = {
  id: string;
  name: string;
  tooth: number | null;
  surfaces: string | null;
  material: string | null;
  procedureCode: string | null;
  diagnosisCode: string | null;
};

const SURFACE_NAME: Record<string, string> = { V: "vestibular", L: "lingual/palatina", M: "mesial", D: "distal", O: "oclusal" };

const listEs = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`);

// Quita sufijos del catálogo como "(por superficie)" que no van en una nota clínica.
export function cleanName(name: string) {
  return name.replace(/\s*\((por (superficie|cuadrante|sextante|unidad|arcada))\)/gi, "").replace(/\s*\(por definir\)/i, "").trim();
}

const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function describeItem(i: DoneItem, lead = "Se realiza") {
  const surfaces = (i.surfaces ?? "").split("").filter((s) => SURFACE_NAME[s]).map((s) => SURFACE_NAME[s]);
  const dx = i.diagnosisCode ? CIE10.find((c) => c.code === i.diagnosisCode) : undefined;
  return [
    `${lead} ${lowerFirst(cleanName(i.name))}`,
    i.tooth ? ` en el diente ${i.tooth}` : "",
    surfaces.length ? ` (superficie${surfaces.length > 1 ? "s" : ""} ${listEs(surfaces)})` : "",
    i.material ? `, material: ${i.material}` : "",
    dx ? `, por ${lowerFirst(dx.label)} (${dx.code})` : "",
    ".",
  ].join("");
}

export const buildEvolutionText = (items: DoneItem[]) => items.map((i, n) => describeItem(i, n === 0 ? "Se realiza" : "Además, se realiza")).join(" ");

// Cambia el bloque redactado automáticamente sin tocar lo que el profesional escribió o dictó.
export function replaceBlock(note: string, oldBlock: string, newBlock: string) {
  if (oldBlock && note.includes(oldBlock)) {
    return newBlock ? note.replace(oldBlock, newBlock) : note.replace(oldBlock, "").replace(/^\s+|\s+$/g, "").replace(/ {2,}/g, " ");
  }
  if (!newBlock) return note;
  return note ? `${newBlock}\n${note}` : newBlock;
}
