// CIE-10, capítulo K00–K14 (4 caracteres, como se reporta en RIPS) y otros códigos frecuentes.
// Los nombres siguen la edición OPS/OMS; falta contrastarlos contra la tabla oficial en producción.
export const CIE10: { code: string; label: string }[] = [
  ["K00.0", "Anodoncia"], ["K00.1", "Dientes supernumerarios"], ["K00.2", "Anomalías del tamaño y de la forma del diente"],
  ["K00.3", "Dientes moteados"], ["K00.4", "Alteraciones en la formación dentaria"], ["K00.5", "Alteraciones hereditarias de la estructura dental"],
  ["K00.6", "Alteraciones en la erupción dentaria"], ["K00.7", "Síndrome de la erupción dentaria"], ["K00.8", "Otros trastornos del desarrollo de los dientes"],
  ["K00.9", "Trastorno del desarrollo de los dientes, no especificado"],
  ["K01.0", "Dientes incluidos"], ["K01.1", "Dientes impactados"],
  ["K02.0", "Caries limitada al esmalte"], ["K02.1", "Caries de la dentina"], ["K02.2", "Caries del cemento"], ["K02.3", "Caries dentaria detenida"],
  ["K02.4", "Odontoclasia"], ["K02.8", "Otras caries dentales"], ["K02.9", "Caries dental, sin otra especificación"],
  ["K03.0", "Atrición excesiva de los dientes"], ["K03.1", "Abrasión de los dientes"], ["K03.2", "Erosión de los dientes"],
  ["K03.3", "Reabsorción patológica de los dientes"], ["K03.4", "Hipercementosis"], ["K03.5", "Anquilosis de los dientes"],
  ["K03.6", "Depósitos (acreciones) en los dientes (placa, cálculo)"], ["K03.7", "Cambios posteruptivos del color de los tejidos duros"],
  ["K03.8", "Otras enfermedades especificadas de los tejidos duros del diente"], ["K03.9", "Enfermedad de los tejidos duros del diente, no especificada"],
  ["K04.0", "Pulpitis"], ["K04.1", "Necrosis de la pulpa"], ["K04.2", "Degeneración de la pulpa"], ["K04.3", "Formación anormal de tejido duro en la pulpa"],
  ["K04.4", "Periodontitis apical aguda de origen pulpar"], ["K04.5", "Periodontitis apical crónica (granuloma apical)"],
  ["K04.6", "Absceso periapical con fístula"], ["K04.7", "Absceso periapical sin fístula"], ["K04.8", "Quiste radicular"],
  ["K04.9", "Otras enfermedades de la pulpa y tejidos periapicales, y las no especificadas"],
  ["K05.0", "Gingivitis aguda"], ["K05.1", "Gingivitis crónica"], ["K05.2", "Periodontitis aguda"], ["K05.3", "Periodontitis crónica"],
  ["K05.4", "Periodontosis"], ["K05.5", "Otras enfermedades periodontales"], ["K05.6", "Enfermedad periodontal, no especificada"],
  ["K06.0", "Retracción gingival"], ["K06.1", "Hiperplasia gingival"], ["K06.2", "Lesiones de la encía y del reborde alveolar sin dientes asociadas con trauma"],
  ["K06.8", "Otros trastornos especificados de la encía y del reborde alveolar sin dientes"], ["K06.9", "Trastorno de la encía y del reborde alveolar sin dientes, no especificado"],
  ["K07.0", "Anomalías mayores del tamaño de los maxilares"], ["K07.1", "Anomalías de la relación maxilobasilar"], ["K07.2", "Anomalías de la relación entre los arcos dentarios"],
  ["K07.3", "Anomalías de la posición del diente"], ["K07.4", "Maloclusión, no especificada"], ["K07.5", "Anomalías dentofaciales funcionales"],
  ["K07.6", "Trastornos de la articulación temporomandibular"], ["K07.8", "Otras anomalías dentofaciales"], ["K07.9", "Anomalía dentofacial, no especificada"],
  ["K08.0", "Exfoliación de los dientes debida a causas sistémicas"], ["K08.1", "Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local"],
  ["K08.2", "Atrofia del reborde alveolar desdentado"], ["K08.3", "Raíz dental retenida"], ["K08.8", "Otros trastornos especificados de los dientes y de sus estructuras de sostén"],
  ["K08.9", "Trastorno de los dientes y de sus estructuras de sostén, no especificado"],
  ["K09.0", "Quistes odontogénicos del desarrollo"], ["K09.1", "Quistes de las áreas bucales del desarrollo (no odontogénicos)"], ["K09.2", "Otros quistes de los maxilares"],
  ["K09.8", "Otros quistes de la región bucal, no clasificados en otra parte"], ["K09.9", "Quiste de la región bucal, sin otra especificación"],
  ["K10.0", "Trastornos del desarrollo de los maxilares"], ["K10.1", "Granuloma central de células gigantes"], ["K10.2", "Afecciones inflamatorias de los maxilares"],
  ["K10.3", "Alveolitis del maxilar (alvéolo seco)"], ["K10.8", "Otras enfermedades especificadas de los maxilares"], ["K10.9", "Enfermedad de los maxilares, no especificada"],
  ["K11.0", "Atrofia de glándula salival"], ["K11.1", "Hipertrofia de glándula salival"], ["K11.2", "Sialoadenitis"], ["K11.3", "Absceso de glándula salival"],
  ["K11.4", "Fístula de glándula salival"], ["K11.5", "Sialolitiasis"], ["K11.6", "Mucocele de glándula salival"], ["K11.7", "Alteraciones de la secreción salival (xerostomía)"],
  ["K11.8", "Otras enfermedades de las glándulas salivales"], ["K11.9", "Enfermedad de glándula salival, no especificada"],
  ["K12.0", "Estomatitis aftosa recurrente"], ["K12.1", "Otras formas de estomatitis"], ["K12.2", "Celulitis y absceso de boca"],
  ["K13.0", "Enfermedades de los labios"], ["K13.1", "Mordedura del carrillo y del labio"], ["K13.2", "Leucoplasia y otras alteraciones del epitelio oral"],
  ["K13.3", "Leucoplasia pilosa"], ["K13.4", "Granuloma y lesiones semejantes de la mucosa oral"], ["K13.5", "Fibrosis de la submucosa oral"],
  ["K13.6", "Hiperplasia irritativa de la mucosa oral"], ["K13.7", "Otras lesiones y las no especificadas de la mucosa oral"],
  ["K14.0", "Glositis"], ["K14.1", "Lengua geográfica"], ["K14.2", "Glositis romboidal mediana"], ["K14.3", "Hipertrofia de las papilas linguales"],
  ["K14.4", "Atrofia de las papilas linguales"], ["K14.5", "Lengua plegada"], ["K14.6", "Glosodinia"], ["K14.8", "Otras enfermedades de la lengua"], ["K14.9", "Enfermedad de la lengua, no especificada"],
  ["S02.5", "Fractura de los dientes"], ["S03.2", "Luxación de diente"], ["B37.0", "Estomatitis candidiásica"], ["B00.2", "Gingivoestomatitis y faringoamigdalitis herpética"],
  ["G50.0", "Neuralgia del trigémino"], ["Z01.2", "Examen odontológico"],
].map(([code, label]) => ({ code, label }));

// CUPS de odontología según el lineamiento RIPS de salud oral de la Secretaría de Salud de Bogotá (2012).
// PENDIENTE: validar cada código contra el anexo vigente (Res. 2706 de 2025). Sin código = no verificado.
export type ProcedureScope = "mouth" | "quadrant" | "tooth" | "surface";
export const PROCEDURES: { id: string; name: string; cups: string | null; scope: ProcedureScope; group: string }[] = [
  { id: "consulta-1", name: "Consulta de primera vez por odontología general", cups: "890203", scope: "mouth", group: "Consultas" },
  { id: "consulta-control", name: "Consulta de control o seguimiento por odontología general", cups: "890303", scope: "mouth", group: "Consultas" },
  { id: "consulta-urg", name: "Consulta de urgencias por odontología general", cups: "890703", scope: "mouth", group: "Consultas" },
  { id: "profilaxis", name: "Profilaxis dental", cups: "997500", scope: "mouth", group: "Prevención" },
  { id: "detartraje-supra", name: "Detartraje supragingival", cups: "997300", scope: "mouth", group: "Prevención" },
  { id: "control-placa", name: "Control de placa bacteriana", cups: "997310", scope: "mouth", group: "Prevención" },
  { id: "sellante-auto", name: "Sellante de autocurado", cups: "997101", scope: "tooth", group: "Prevención" },
  { id: "sellante-foto", name: "Sellante de fotocurado", cups: "997102", scope: "tooth", group: "Prevención" },
  { id: "fluor-gel", name: "Aplicación de flúor en gel", cups: "997103", scope: "mouth", group: "Prevención" },
  { id: "fluor-sol", name: "Aplicación de flúor en solución", cups: "997104", scope: "mouth", group: "Prevención" },
  { id: "resina-prev", name: "Resina preventiva", cups: "997105", scope: "tooth", group: "Prevención" },
  { id: "educacion-higiene", name: "Educación individual en higiene oral", cups: "990212", scope: "mouth", group: "Prevención" },
  { id: "obt-amalgama", name: "Obturación con amalgama (por superficie)", cups: "232101", scope: "surface", group: "Operatoria" },
  { id: "obt-resina", name: "Obturación con resina de fotocurado (por superficie)", cups: "232102", scope: "surface", group: "Operatoria" },
  { id: "obt-ionomero", name: "Obturación con ionómero de vidrio (por superficie)", cups: "232103", scope: "surface", group: "Operatoria" },
  { id: "restauracion-por-definir", name: "Restauración definitiva (por definir)", cups: null, scope: "tooth", group: "Operatoria" },
  { id: "obt-temporal", name: "Obturación temporal", cups: "232200", scope: "tooth", group: "Operatoria" },
  { id: "pulpotomia", name: "Pulpotomía", cups: "237100", scope: "tooth", group: "Endodoncia" },
  { id: "recub-directo", name: "Recubrimiento pulpar directo", cups: "237503", scope: "tooth", group: "Endodoncia" },
  { id: "recub-indirecto", name: "Recubrimiento pulpar indirecto", cups: "237504", scope: "tooth", group: "Endodoncia" },
  { id: "endo-uni", name: "Tratamiento de conducto unirradicular", cups: "237301", scope: "tooth", group: "Endodoncia" },
  { id: "endo-bi", name: "Tratamiento de conducto birradicular", cups: "237302", scope: "tooth", group: "Endodoncia" },
  { id: "endo-multi", name: "Tratamiento de conducto multirradicular", cups: "237303", scope: "tooth", group: "Endodoncia" },
  { id: "exo-uni", name: "Exodoncia permanente unirradicular", cups: "230101", scope: "tooth", group: "Cirugía" },
  { id: "exo-multi", name: "Exodoncia permanente multirradicular", cups: "230102", scope: "tooth", group: "Cirugía" },
  { id: "exo-quir-uni", name: "Exodoncia quirúrgica unirradicular", cups: "231100", scope: "tooth", group: "Cirugía" },
  { id: "exo-quir-multi", name: "Exodoncia quirúrgica multirradicular", cups: "231200", scope: "tooth", group: "Cirugía" },
  { id: "exo-incluido", name: "Exodoncia de diente incluido", cups: "231301", scope: "tooth", group: "Cirugía" },
  { id: "regulariz-rebordes", name: "Regularización de rebordes (por cuadrante)", cups: "245100", scope: "quadrant", group: "Cirugía" },
  { id: "detartraje-sub", name: "Detartraje subgingival (por cuadrante)", cups: "240200", scope: "quadrant", group: "Periodoncia" },
  { id: "alisado", name: "Alisado radicular (por sextante)", cups: "240300", scope: "quadrant", group: "Periodoncia" },
  { id: "gingivectomia", name: "Gingivectomía", cups: "243400", scope: "quadrant", group: "Periodoncia" },
  { id: "corona-acero", name: "Corona de acero inoxidable", cups: "234101", scope: "tooth", group: "Rehabilitación" },
  { id: "corona-acrilica", name: "Corona acrílica termocurada", cups: "234104", scope: "tooth", group: "Rehabilitación" },
  { id: "corona-definitiva", name: "Corona definitiva (porcelana / metal-cerámica)", cups: null, scope: "tooth", group: "Rehabilitación" },
  { id: "protesis-fija", name: "Prótesis fija (por unidad)", cups: "234201", scope: "tooth", group: "Rehabilitación" },
  { id: "munon", name: "Reconstrucción de muñón", cups: "234202", scope: "tooth", group: "Rehabilitación" },
  { id: "perno", name: "Perno o núcleo", cups: "234203", scope: "tooth", group: "Rehabilitación" },
  { id: "removible-1", name: "Prótesis removible (acrílico)", cups: "234301", scope: "mouth", group: "Rehabilitación" },
  { id: "removible-2", name: "Prótesis removible (metal / flexible)", cups: "234302", scope: "mouth", group: "Rehabilitación" },
  { id: "total-medio", name: "Prótesis total, medio caso", cups: "234401", scope: "mouth", group: "Rehabilitación" },
  { id: "total-completa", name: "Prótesis total superior e inferior", cups: "234402", scope: "mouth", group: "Rehabilitación" },
  { id: "implante", name: "Implante dental", cups: "236300", scope: "tooth", group: "Rehabilitación" },
  { id: "blanqueamiento", name: "Blanqueamiento dental", cups: null, scope: "mouth", group: "Estética" },
  { id: "orto-evaluacion", name: "Evaluación ortodóntica", cups: "893103", scope: "mouth", group: "Ortodoncia" },
  { id: "orto-fija", name: "Aparatología fija (por arcada)", cups: "247100", scope: "mouth", group: "Ortodoncia" },
  { id: "orto-removible", name: "Aparatología removible intraoral", cups: "247201", scope: "mouth", group: "Ortodoncia" },
  { id: "orto-retencion", name: "Aparato de retención", cups: "247300", scope: "mouth", group: "Ortodoncia" },
  { id: "orto-control", name: "Control de ortodoncia", cups: "893106", scope: "mouth", group: "Ortodoncia" },
  { id: "rx-periapical", name: "Radiografía periapical", cups: "870450", scope: "tooth", group: "Ayudas diagnósticas" },
  { id: "rx-coronal", name: "Radiografía coronal (aleta de mordida)", cups: "870460", scope: "mouth", group: "Ayudas diagnósticas" },
  { id: "rx-panoramica", name: "Radiografía panorámica", cups: "870114", scope: "mouth", group: "Ayudas diagnósticas" },
  { id: "otro", name: "Otro procedimiento (describir)", cups: null, scope: "mouth", group: "Otros" },
];

// Mantenemos esta lista para el autocompletado de la evolución.
export const CUPS = PROCEDURES.filter((p) => p.cups).map((p) => ({ code: p.cups as string, label: p.name }));

// Materiales por procedimiento. "default" es el que se propone al crear el ítem; el odontólogo puede cambiarlo.
export const MATERIALS: Record<string, { options: string[]; default?: string }> = {
  "corona-definitiva": { options: ["Zirconio", "Disilicato de litio (e.max)", "Metal-cerámica", "Resina", "Metal"], default: "Zirconio" },
  "protesis-fija": { options: ["Zirconio", "Metal-cerámica", "Disilicato de litio (e.max)", "Acrílico"], default: "Zirconio" },
  "restauracion-por-definir": { options: ["Resina compuesta", "Zirconio", "Disilicato de litio (e.max)", "Porcelana (carilla)", "Metal-cerámica"] },
  perno: { options: ["Fibra de vidrio", "Metal colado"], default: "Fibra de vidrio" },
  munon: { options: ["Resina", "Ionómero de vidrio"], default: "Resina" },
  "removible-1": { options: ["Acrílico", "Flexible", "Metal"], default: "Acrílico" },
  "removible-2": { options: ["Metal", "Flexible"], default: "Metal" },
  implante: { options: ["Titanio", "Zirconio"], default: "Titanio" },
};

// Opciones para decidir una "restauración por definir" (lista de procedimientos disponibles).
export const RESTORATION_OPTIONS = ["obt-resina", "corona-definitiva", "protesis-fija", "munon", "perno"];

export const PHASES = [
  { n: 1, label: "Urgencia" },
  { n: 2, label: "Control de la enfermedad" },
  { n: 3, label: "Rehabilitación" },
  { n: 4, label: "Mantenimiento" },
] as const;

export const NOTE_TEMPLATES = [
  "Se realiza anestesia infiltrativa, aislamiento y procedimiento sin complicaciones.",
  "Paciente tolera bien el procedimiento. Se dan indicaciones postoperatorias.",
  "Se realiza profilaxis y control de placa. Se refuerza técnica de cepillado.",
  "Se prescribe analgésico y se cita a control.",
];

// Cada estado combina color + abreviatura para no depender solo del color.
// scope: "surface" se aplica por superficie; "tooth" afecta todo el diente.
export const CONDITIONS = {
  HEALTHY: { label: "Borrar", abbr: "", scope: "surface", fill: "#ffffff", cls: "bg-white text-slate-900 border-slate-500" },
  CARIES_ENAMEL: { label: "Caries de esmalte", abbr: "CE", scope: "surface", fill: "#fca5a5", cls: "bg-red-200 text-slate-900 border-red-700" },
  CARIES: { label: "Caries de dentina", abbr: "CD", scope: "surface", fill: "#dc2626", cls: "bg-red-600 text-white border-red-800" },
  FILLING: { label: "Obturación", abbr: "Ob", scope: "surface", fill: "#2563eb", cls: "bg-blue-600 text-white border-blue-800" },
  SEALANT: { label: "Sellante", abbr: "Se", scope: "surface", fill: "#15803d", cls: "bg-green-700 text-white border-green-900" },
  FRACTURE: { label: "Fractura", abbr: "Fr", scope: "surface", fill: "#c2410c", cls: "bg-orange-700 text-white border-orange-900" },
  CROWN: { label: "Corona", abbr: "Co", scope: "tooth", fill: "#fcd34d", cls: "bg-amber-300 text-slate-900 border-amber-700" },
  ROOT_CANAL: { label: "Endodoncia", abbr: "En", scope: "tooth", fill: "#9333ea", cls: "bg-purple-600 text-white border-purple-800" },
  IMPLANT: { label: "Implante", abbr: "Im", scope: "tooth", fill: "#0f766e", cls: "bg-teal-700 text-white border-teal-900" },
  IMPACTED: { label: "Retenido / impactado", abbr: "Re", scope: "tooth", fill: "#4f46e5", cls: "bg-indigo-600 text-white border-indigo-800" },
  PARTIAL: { label: "Parcialmente erupcionado", abbr: "PE", scope: "tooth", fill: "#bef264", cls: "bg-lime-300 text-slate-900 border-lime-700" },
  EXTRACTED: { label: "Extraído", abbr: "Ex", scope: "tooth", fill: "#334155", cls: "bg-slate-700 text-white border-slate-900" },
  MISSING: { label: "Ausente", abbr: "Au", scope: "tooth", fill: "#e2e8f0", cls: "bg-slate-200 text-slate-800 border-slate-600 border-dashed" },
} as const;

export type ConditionKey = keyof typeof CONDITIONS;

export const SURFACES = [
  { key: "V", label: "Vestibular" },
  { key: "L", label: "Lingual/Palatino" },
  { key: "M", label: "Mesial" },
  { key: "D", label: "Distal" },
  { key: "O", label: "Oclusal/Incisal" },
] as const;

// Cuadrantes FDI en el orden en que se ven de frente al paciente.
export const QUADRANTS = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
];

export const VALID_TEETH = new Set(QUADRANTS.flat());
