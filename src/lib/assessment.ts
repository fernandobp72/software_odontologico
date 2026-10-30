// Definición de la valoración clínica (anamnesis + examen). El formulario, la validación
// y la vista de solo lectura salen de esta misma lista.
export type FieldType = "text" | "textarea" | "number" | "select" | "checks";
export type Field = { name: string; label: string; type: FieldType; options?: string[]; hint?: string };
export type Section = { id: string; title: string; fields: Field[] };

const YN = ["No", "Sí"];

export const ASSESSMENT_SECTIONS: Section[] = [
  {
    id: "motivo",
    title: "Motivo de consulta y enfermedad actual",
    fields: [
      { name: "motivo", label: "Motivo de consulta (en palabras del paciente)", type: "textarea" },
      { name: "enfermedadActual", label: "Enfermedad actual (cronología, dolor, factores)", type: "textarea" },
    ],
  },
  {
    id: "medicos",
    title: "Antecedentes médicos",
    fields: [
      {
        name: "enfermedades", label: "Enfermedades", type: "checks",
        options: ["Diabetes", "Hipertensión", "Cardiopatía", "Asma / EPOC", "Hepatitis", "VIH", "Epilepsia", "Trastorno de coagulación", "Enfermedad renal", "Enfermedad tiroidea", "Cáncer / radioterapia", "Embarazo", "Osteoporosis / bifosfonatos", "Requiere profilaxis antibiótica"],
      },
      { name: "medicamentos", label: "Medicamentos actuales (anticoagulantes, bifosfonatos, otros)", type: "textarea" },
      { name: "alergias", label: "Alergias", type: "checks", options: ["Anestésicos", "Penicilina / antibióticos", "Látex", "AINES", "Yodo", "Otra"] },
      { name: "alergiasOtras", label: "Detalle de alergias", type: "text" },
      { name: "cirugias", label: "Cirugías y hospitalizaciones previas", type: "textarea" },
      { name: "familiares", label: "Antecedentes familiares", type: "textarea" },
    ],
  },
  {
    id: "odonto",
    title: "Antecedentes y hábitos odontológicos",
    fields: [
      { name: "ultimaVisita", label: "Última visita al odontólogo", type: "text" },
      { name: "cepillado", label: "Cepillado al día", type: "select", options: ["1", "2", "3", "4 o más"] },
      { name: "sedaDental", label: "Usa seda dental", type: "select", options: ["Nunca", "A veces", "Diario"] },
      { name: "sintomas", label: "Síntomas", type: "checks", options: ["Dolor", "Sensibilidad", "Sangrado de encías", "Halitosis", "Boca seca", "Movilidad dental", "Ruidos en la ATM"] },
      { name: "habitos", label: "Hábitos", type: "checks", options: ["Tabaquismo", "Alcohol", "Bruxismo", "Onicofagia", "Respiración oral", "Succión digital", "Dieta cariogénica"] },
      { name: "traumas", label: "Traumas, cirugías orales, ortodoncia y reacciones a anestesia", type: "textarea" },
    ],
  },
  {
    id: "vitales",
    title: "Signos vitales",
    fields: [
      { name: "ta", label: "Tensión arterial (mmHg)", type: "text", hint: "120/80" },
      { name: "fc", label: "Frecuencia cardiaca (lpm)", type: "number" },
      { name: "fr", label: "Frecuencia respiratoria (rpm)", type: "number" },
      { name: "temp", label: "Temperatura (°C)", type: "number" },
      { name: "peso", label: "Peso (kg)", type: "number" },
      { name: "talla", label: "Talla (cm)", type: "number" },
    ],
  },
  {
    id: "extraoral",
    title: "Examen extraoral y ATM",
    fields: [
      { name: "facial", label: "Cara, simetría, piel, ganglios", type: "textarea" },
      { name: "atmApertura", label: "Apertura bucal (mm)", type: "number" },
      { name: "atmHallazgos", label: "ATM", type: "checks", options: ["Ruido / chasquido", "Dolor", "Desviación", "Limitación de apertura", "Dolor muscular a la palpación"] },
    ],
  },
  {
    id: "intraoral",
    title: "Examen intraoral de tejidos blandos",
    fields: [
      { name: "tejidos", label: "Labios, mucosa, lengua, piso de boca, paladar, orofaringe", type: "textarea" },
      { name: "tamizajeCancer", label: "Tamizaje de cáncer oral", type: "select", options: ["Sin hallazgos", "Hallazgos (describir en observaciones)"] },
    ],
  },
  {
    id: "riesgo",
    title: "Higiene, caries y periodonto",
    fields: [
      { name: "placa", label: "Índice de placa (%)", type: "number" },
      { name: "calculo", label: "Cálculo", type: "select", options: ["Ausente", "Supragingival", "Subgingival", "Ambos"] },
      { name: "copC", label: "COP-D: cariados", type: "number" },
      { name: "copO", label: "COP-D: obturados", type: "number" },
      { name: "copP", label: "COP-D: perdidos", type: "number" },
      { name: "riesgoCaries", label: "Riesgo de caries", type: "select", options: ["Bajo", "Moderado", "Alto"] },
      { name: "periodonto", label: "Estado periodontal", type: "select", options: ["Sano", "Gingivitis", "Periodontitis estadio I", "Periodontitis estadio II", "Periodontitis estadio III", "Periodontitis estadio IV"] },
      { name: "sangrado", label: "Sangrado al sondaje", type: "select", options: YN },
      { name: "movilidad", label: "Movilidad dental", type: "select", options: YN },
    ],
  },
  {
    id: "oclusion",
    title: "Oclusión",
    fields: [
      { name: "angle", label: "Clase molar de Angle", type: "select", options: ["I", "II división 1", "II división 2", "III"] },
      { name: "mordida", label: "Alteraciones", type: "checks", options: ["Mordida abierta", "Mordida cruzada", "Mordida profunda", "Apiñamiento", "Diastemas", "Interferencias"] },
    ],
  },
  {
    id: "ayudas",
    title: "Ayudas diagnósticas, pronóstico y observaciones",
    fields: [
      { name: "ayudas", label: "Ayudas diagnósticas solicitadas e interpretación", type: "textarea" },
      { name: "pronostico", label: "Pronóstico general", type: "select", options: ["Bueno", "Reservado", "Malo"] },
      { name: "observaciones", label: "Observaciones", type: "textarea" },
    ],
  },
];

export type AssessmentData = Record<string, string | string[]>;

export function copTotal(d: AssessmentData | null | undefined) {
  if (!d) return null;
  const n = (k: string) => Number(d[k] ?? 0) || 0;
  return n("copC") + n("copO") + n("copP");
}
