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

// Cada estado combina color + abreviatura para no depender solo del color.
// scope: "surface" se aplica por superficie; "tooth" afecta todo el diente.
export const CONDITIONS = {
  HEALTHY: { label: "Borrar", abbr: "", scope: "surface", fill: "#ffffff", cls: "bg-white text-slate-900 border-slate-500" },
  CARIES: { label: "Caries", abbr: "Ca", scope: "surface", fill: "#dc2626", cls: "bg-red-600 text-white border-red-800" },
  FILLING: { label: "Obturación", abbr: "Ob", scope: "surface", fill: "#2563eb", cls: "bg-blue-600 text-white border-blue-800" },
  SEALANT: { label: "Sellante", abbr: "Se", scope: "surface", fill: "#15803d", cls: "bg-green-700 text-white border-green-900" },
  FRACTURE: { label: "Fractura", abbr: "Fr", scope: "surface", fill: "#c2410c", cls: "bg-orange-700 text-white border-orange-900" },
  CROWN: { label: "Corona", abbr: "Co", scope: "tooth", fill: "#fcd34d", cls: "bg-amber-300 text-slate-900 border-amber-700" },
  ROOT_CANAL: { label: "Endodoncia", abbr: "En", scope: "tooth", fill: "#9333ea", cls: "bg-purple-600 text-white border-purple-800" },
  IMPLANT: { label: "Implante", abbr: "Im", scope: "tooth", fill: "#0f766e", cls: "bg-teal-700 text-white border-teal-900" },
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
