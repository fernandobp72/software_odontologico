// CIE-10 frecuentes en odontología. El catálogo oficial completo se importará aparte.
export const CIE10 = [
  { code: "K00.6", label: "Alteraciones en la erupción dentaria" },
  { code: "K01.1", label: "Diente impactado" },
  { code: "K02.0", label: "Caries limitada al esmalte" },
  { code: "K02.1", label: "Caries de la dentina" },
  { code: "K02.2", label: "Caries del cemento" },
  { code: "K03.1", label: "Abrasión de los dientes" },
  { code: "K04.0", label: "Pulpitis" },
  { code: "K04.1", label: "Necrosis de la pulpa" },
  { code: "K04.7", label: "Absceso periapical sin fístula" },
  { code: "K05.0", label: "Gingivitis aguda" },
  { code: "K05.1", label: "Gingivitis crónica" },
  { code: "K05.3", label: "Periodontitis crónica" },
  { code: "K07.3", label: "Anomalías de la posición dentaria" },
  { code: "S02.5", label: "Fractura de los dientes" },
  { code: "Z01.2", label: "Examen odontológico" },
];

// CUPS: solo códigos verificados. TODO: importar el catálogo oficial completo.
export const CUPS = [
  { code: "890203", label: "Consulta de primera vez por odontología general" },
  { code: "890303", label: "Consulta de control o seguimiento por odontología general" },
];

export const NOTE_TEMPLATES = [
  "Se realiza anestesia infiltrativa, aislamiento y procedimiento sin complicaciones.",
  "Paciente tolera bien el procedimiento. Se dan indicaciones postoperatorias.",
  "Se realiza profilaxis y control de placa. Se refuerza técnica de cepillado.",
  "Se prescribe analgésico y se cita a control.",
];

export const CONDITIONS = {
  HEALTHY: { label: "Sano (borrar)", color: "bg-white" },
  CARIES: { label: "Caries", color: "bg-red-400" },
  FILLING: { label: "Obturación", color: "bg-blue-400" },
  CROWN: { label: "Corona", color: "bg-amber-400" },
  ROOT_CANAL: { label: "Endodoncia", color: "bg-purple-400" },
  EXTRACTED: { label: "Extraído", color: "bg-slate-500" },
  MISSING: { label: "Ausente", color: "bg-slate-300" },
  IMPLANT: { label: "Implante", color: "bg-teal-400" },
  SEALANT: { label: "Sellante", color: "bg-green-400" },
  FRACTURE: { label: "Fractura", color: "bg-orange-400" },
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
