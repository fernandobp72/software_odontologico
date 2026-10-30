import { ASSESSMENT_SECTIONS, type AssessmentData, type Field, type Section } from "./assessment";

// Lo que el paciente puede contestar solo. Reutiliza las opciones de la valoración y cambia
// los textos por lenguaje sencillo; las claves son las mismas para poder pasarlas a la historia.
const PLAIN: Record<string, { section: string; label: string }> = {
  motivo: { section: "Tu visita", label: "¿Por qué vienes a consulta?" },
  enfermedadActual: { section: "Tu visita", label: "Cuéntanos qué sientes o desde cuándo (dolor, molestia, inflamación…)" },
  enfermedades: { section: "Tu salud", label: "¿Tienes o has tenido alguna de estas condiciones?" },
  medicamentos: { section: "Tu salud", label: "¿Qué medicamentos tomas? (incluye anticoagulantes y vitaminas)" },
  alergias: { section: "Tu salud", label: "¿Eres alérgico(a) a algo de esto?" },
  alergiasOtras: { section: "Tu salud", label: "Si marcaste alergias, cuéntanos cuál" },
  cirugias: { section: "Tu salud", label: "Cirugías u hospitalizaciones previas" },
  familiares: { section: "Tu salud", label: "Enfermedades importantes en tu familia" },
  ultimaVisita: { section: "Tu boca", label: "¿Cuándo fue tu última visita al odontólogo?" },
  cepillado: { section: "Tu boca", label: "¿Cuántas veces te cepillas al día?" },
  sedaDental: { section: "Tu boca", label: "¿Usas seda dental?" },
  sintomas: { section: "Tu boca", label: "¿Tienes alguno de estos síntomas?" },
  habitos: { section: "Tu boca", label: "¿Tienes alguno de estos hábitos?" },
  traumas: { section: "Tu boca", label: "Golpes en la boca, ortodoncia o reacciones a la anestesia" },
};

const byName = new Map<string, Field>();
for (const s of ASSESSMENT_SECTIONS) for (const f of s.fields) byName.set(f.name, f);

export const INTAKE_SECTIONS: Section[] = (() => {
  const out: Section[] = [];
  for (const [name, p] of Object.entries(PLAIN)) {
    const base = byName.get(name);
    if (!base) continue;
    let sec = out.find((s) => s.title === p.section);
    if (!sec) out.push((sec = { id: p.section, title: p.section, fields: [] }));
    sec.fields.push({ ...base, label: p.label });
  }
  return out;
})();

export const INTAKE_DAYS = 7;

export function parseIntake(fd: FormData): AssessmentData {
  const data: AssessmentData = {};
  for (const s of INTAKE_SECTIONS) {
    for (const f of s.fields) {
      if (f.type === "checks") {
        const vals = fd.getAll(f.name).map(String).filter((v) => f.options?.includes(v));
        if (vals.length) data[f.name] = vals;
      } else {
        const v = String(fd.get(f.name) ?? "").trim().slice(0, 1000);
        if (!v) continue;
        if (f.type === "select" && !f.options?.includes(v)) continue;
        data[f.name] = v;
      }
    }
  }
  return data;
}

// Mezcla lo que contestó el paciente sobre la valoración vigente sin borrar lo que ya hay.
export function mergeIntake(current: AssessmentData | null, intake: AssessmentData): AssessmentData {
  const out: AssessmentData = { ...(current ?? {}) };
  for (const [k, v] of Object.entries(intake)) {
    const cur = out[k];
    if (Array.isArray(v)) out[k] = Array.isArray(cur) ? [...new Set([...cur, ...v])] : v;
    else out[k] = typeof cur === "string" && cur && cur !== v ? `${cur} | Paciente: ${v}` : v;
  }
  return out;
}
