// Plantillas de consentimiento informado.
// BORRADOR: los textos son una base genérica y deben ser revisados y aprobados por asesoría
// jurídica y por el director técnico del consultorio antes de usarse con pacientes reales.
export const CONSENT_VERSION = "2026-10-borrador";

export type ConsentTemplate = { id: string; title: string; risks: string };

const COMMON_HEAD = `Yo, {paciente}, identificado(a) con {documento}, declaro que el/la odontólogo(a) {profesional} me ha explicado, con palabras claras y comprensibles, mi diagnóstico, el tratamiento propuesto, sus beneficios, las alternativas disponibles (incluida la opción de no tratarme) y los riesgos y posibles complicaciones. Pude hacer preguntas y fueron respondidas a mi satisfacción.`;

const COMMON_TAIL = `Entiendo que el resultado del tratamiento no puede garantizarse de manera absoluta y que depende también de mi colaboración: asistir a los controles, seguir las indicaciones, mantener una buena higiene oral e informar cualquier cambio en mi estado de salud. Declaré de forma veraz mis antecedentes médicos, alergias y medicamentos. Puedo revocar este consentimiento antes del procedimiento, sin que ello afecte mi derecho a ser atendido(a). Autorizo el procedimiento descrito.`;

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
  {
    id: "general",
    title: "Consentimiento informado general para tratamiento odontológico",
    risks: "Todo procedimiento odontológico puede implicar molestias, dolor, inflamación, sangrado, reacciones a medicamentos o a la anestesia, y la necesidad de tratamientos adicionales.",
  },
  {
    id: "exodoncia",
    title: "Consentimiento informado para exodoncia (extracción dental)",
    risks: "Riesgos: dolor e inflamación posoperatoria, sangrado, infección, alveolitis (alvéolo seco), fractura de la raíz o del diente, lesión de dientes vecinos, alteración temporal o permanente de la sensibilidad de labio, lengua o mentón, comunicación con el seno maxilar y limitación temporal de la apertura bucal.",
  },
  {
    id: "endodoncia",
    title: "Consentimiento informado para tratamiento de conducto (endodoncia)",
    risks: "Riesgos: dolor o inflamación posterior, fractura de instrumentos dentro del conducto, perforación, conductos que no pueden limpiarse por completo, persistencia o reaparición de la infección con necesidad de retratamiento o cirugía, oscurecimiento del diente y mayor riesgo de fractura del diente, que suele requerir una restauración definitiva.",
  },
  {
    id: "implante",
    title: "Consentimiento informado para implantes dentales y cirugía oral",
    risks: "Riesgos: infección, sangrado, hematoma, falta de integración del implante con el hueso, pérdida del implante, lesión de nervios con alteración de la sensibilidad, comunicación con el seno maxilar, necesidad de injertos óseos, inflamación alrededor del implante (periimplantitis) y necesidad de mantenimiento y controles periódicos.",
  },
  {
    id: "ortodoncia",
    title: "Consentimiento informado para tratamiento de ortodoncia",
    risks: "Riesgos: molestias al inicio y tras los ajustes, descalcificación y caries si la higiene es deficiente, inflamación de encías, acortamiento de raíces, recidiva si no se usan los retenedores, duración del tratamiento mayor a la estimada y necesidad de asistir a controles periódicos.",
  },
  {
    id: "anestesia",
    title: "Consentimiento informado para anestesia local",
    risks: "Riesgos: dolor o hematoma en el sitio de punción, adormecimiento prolongado o alteración de la sensibilidad, limitación temporal de la apertura bucal, reacciones alérgicas o toxicidad por el anestésico, y mordedura accidental de labio o lengua mientras dura el efecto.",
  },
  {
    id: "blanqueamiento",
    title: "Consentimiento informado para blanqueamiento dental",
    risks: "Riesgos: sensibilidad dental transitoria, irritación de encías, resultados distintos según el tipo de mancha, y que las restauraciones existentes no cambian de color.",
  },
];

export function buildConsentBody(t: ConsentTemplate, v: { paciente: string; documento: string; profesional: string; procedimiento?: string }) {
  const head = COMMON_HEAD.replace("{paciente}", v.paciente).replace("{documento}", v.documento).replace("{profesional}", v.profesional);
  return [head, v.procedimiento ? `Procedimiento: ${v.procedimiento}` : null, t.risks, COMMON_TAIL].filter(Boolean).join("\n\n");
}
