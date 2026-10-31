// Vademécum odontológico de apoyo a la prescripción. Solo medicamentos de venta bajo fórmula médica común o de venta libre
// usados en odontología; NO incluye medicamentos de control especial (opioides como tramadol o codeína, benzodiacepinas).
// Las dosis son las habituales para adultos y niños según guías y literatura de referencia; el odontólogo siempre revisa,
// ajusta y firma. Las presentaciones se contrastan con el Código Único de Medicamentos vigentes del INVIMA (src/lib/invima.ts).
export const VADEMECUM_VERSION = "2026-10";

export type Form = "tableta" | "capsula" | "suspension" | "solucion" | "gel" | "crema" | "enjuague" | "ampolla";
export type Presentation = {
  id: string;
  label: string; // «Tableta 500 mg»
  form: Form;
  strength: string; // «500 mg»
  unit: string; // «tableta», «cápsula», «mL», «aplicación»
  mgPerUnit?: number; // por tableta/cápsula
  mgPerMl?: number; // para líquidos
  bottleMl?: number; // tamaño de frasco habitual para líquidos
  route: string;
  // Para contrastar con el INVIMA: fragmentos de la forma farmacéutica y el número de concentración que debe aparecer en el registro.
  cumForm: string[];
  cumStrength: string;
  atc?: string; // si la presentación tiene otro ATC que el medicamento (p. ej. la crema)
  cumRegex?: string; // patrón propio para reconocer la concentración en el registro del INVIMA
  cumNote?: string; // qué decir si no aparece en el CUM
};

export type Regimen = {
  units?: number; // unidades por toma (tabletas)
  doseText?: string; // si no es por unidades (p. ej. «15 mL»)
  mlPerDose?: number;
  everyHours?: number;
  timesPerDay?: number;
  days: number;
  note?: string; // pauta especial (p. ej. dosis de carga)
};

// Pediátrico: mg por kg al día repartidos en tomas (solo para líquidos o fraccionables).
export type Pediatric = { mgPerKgDay: number; divided: number; maxMgPerKgDay?: number; maxDoseMg?: number; days: number; minAgeYears?: number };

export type Tag =
  | "allergy_penicillin" | "allergy_nsaid" | "allergy_other"
  | "pregnancy" | "renal" | "hepatic" | "coagulation" | "asthma" | "hypertension" | "diabetes" | "cardiac" | "epilepsy"
  | "anticoagulant" | "age_lt_8" | "gi_bleed";

export type Warning = { tag: Tag; level: "stop" | "warn"; text: string; maxAge?: number }; // maxAge: solo aplica a menores de esa edad (etiqueta age_lt_8)
export type Interaction = { drugs: RegExp; level: "stop" | "warn"; text: string };

export type Drug = {
  id: string;
  dci: string; // denominación común internacional (la que se escribe en la fórmula)
  atc: string;
  group: "Analgésico" | "Antiinflamatorio (AINE)" | "Corticoide" | "Antibiótico" | "Antifúngico" | "Antiviral" | "Antiséptico / tópico" | "Gastroprotector" | "Hemostático";
  classes: string[]; // para cruzar con alergias (p. ej. «penicilina», «ains»)
  presentations: Presentation[];
  adult: Regimen;
  ped?: Pediatric;
  pedSameAsAdult?: boolean; // tópicos y enjuagues que en niños mayores se usan igual
  warnings: Warning[];
  interactions: Interaction[];
  indication: string;
  instructions: string;
};

const P = (id: string, label: string, form: Form, strength: string, unit: string, route: string, cumStrength: string, extra: Partial<Presentation> = {}): Presentation => ({
  id, label, form, strength, unit, route, cumStrength,
  cumForm: form === "tableta" ? ["TABLETA"] : form === "capsula" ? ["CAPSULA"] : form === "suspension" ? ["SUSPENSION"] : form === "solucion" ? ["SOLUCION"] : form === "gel" ? ["GEL"] : form === "crema" ? ["CREMA", "UNGUENTO", "PASTA"] : form === "enjuague" ? ["SOLUCION", "ENJUAGUE", "COLUTORIO"] : ["INYECTABLE", "SOLUCION"],
  ...extra,
});

const NSAID_WARNINGS: Warning[] = [
  { tag: "allergy_nsaid", level: "stop", text: "Alergia a AINES referida" },
  { tag: "pregnancy", level: "stop", text: "Embarazo: evitar AINES (riesgo fetal, sobre todo después de la semana 20)" },
  { tag: "renal", level: "stop", text: "Enfermedad renal: los AINES pueden empeorar la función renal" },
  { tag: "coagulation", level: "stop", text: "Trastorno de coagulación o anticoagulación: los AINES aumentan el riesgo de sangrado" },
  { tag: "gi_bleed", level: "stop", text: "Antecedente de sangrado o úlcera gástrica" },
  { tag: "asthma", level: "warn", text: "Asma: los AINES pueden desencadenar broncoespasmo en personas sensibles" },
  { tag: "hypertension", level: "warn", text: "Hipertensión: los AINES pueden subir la tensión y reducir el efecto de los antihipertensivos; usar pocos días" },
  { tag: "cardiac", level: "warn", text: "Cardiopatía: los AINES aumentan el riesgo cardiovascular; preferir acetaminofén" },
  { tag: "diabetes", level: "warn", text: "Diabetes: vigilar la función renal; usar pocos días" },
];
const NSAID_INTERACTIONS: Interaction[] = [
  { drugs: /warfarina|acenocumarol|rivaroxab|apixab|dabigatr|clopidogrel|heparina|enoxaparina|aspirina|[aá]cido acetilsalic/i, level: "stop", text: "Con anticoagulantes o antiagregantes aumenta el riesgo de sangrado" },
  { drugs: /litio|metotrexato/i, level: "stop", text: "Aumenta la toxicidad del litio o del metotrexato" },
  { drugs: /enalapril|losart[aá]n|captopril|lisinopril|valsart[aá]n|candesart[aá]n|furosemida|hidroclorotiazida|espironolactona/i, level: "warn", text: "Con antihipertensivos o diuréticos: riesgo de daño renal y menor efecto antihipertensivo" },
  { drugs: /prednisona|prednisolona|dexametasona|betametasona|hidrocortisona/i, level: "warn", text: "Con corticoides aumenta el riesgo de sangrado gástrico: considerar omeprazol" },
];

export const DRUGS: Drug[] = [
  {
    id: "acetaminofen", dci: "Acetaminofén (paracetamol)", atc: "N02BE01", group: "Analgésico", classes: ["acetaminofen"],
    presentations: [
      P("tab500", "Tableta 500 mg", "tableta", "500 mg", "tableta", "Oral", "500", { mgPerUnit: 500 }),
      P("susp", "Suspensión oral 250 mg/5 mL", "suspension", "250 mg/5 mL", "mL", "Oral", "250", { mgPerMl: 50, bottleMl: 90, cumRegex: "250\\s*MG\\s*/\\s*5\\s*ML|5[.,]0\\s*%|50\\s*MG\\s*/\\s*ML" }),
    ],
    adult: { units: 1, everyHours: 8, days: 3, note: "Puede tomarse 1 a 2 tabletas por vez (máximo 3 g al día)" },
    ped: { mgPerKgDay: 45, divided: 4, maxMgPerKgDay: 60, maxDoseMg: 500, days: 3 },
    warnings: [
      { tag: "hepatic", level: "warn", text: "Enfermedad hepática: máximo 2 g al día" },
      { tag: "allergy_other", level: "stop", text: "Alergia referida al acetaminofén" },
    ],
    interactions: [{ drugs: /warfarina|acenocumarol/i, level: "warn", text: "Con warfarina, el uso continuado puede subir el INR" }],
    indication: "Dolor leve a moderado. Primera opción en embarazo, hipertensión, renal y trastornos de coagulación.",
    instructions: "No pasar de la dosis máxima diaria. Evitar otros productos que contengan acetaminofén.",
  },
  {
    id: "ibuprofeno", dci: "Ibuprofeno", atc: "M01AE01", group: "Antiinflamatorio (AINE)", classes: ["ains", "ibuprofeno"],
    presentations: [
      P("tab400", "Tableta 400 mg", "tableta", "400 mg", "tableta", "Oral", "400", { mgPerUnit: 400 }),
      P("tab600", "Tableta 600 mg", "tableta", "600 mg", "tableta", "Oral", "600", { mgPerUnit: 600 }),
      P("susp", "Suspensión oral 100 mg/5 mL", "suspension", "100 mg/5 mL", "mL", "Oral", "100", { mgPerMl: 20, bottleMl: 120 }),
    ],
    adult: { units: 1, everyHours: 8, days: 3, note: "Con las comidas; máximo 1.200 mg al día salvo indicación contraria" },
    ped: { mgPerKgDay: 30, divided: 3, maxMgPerKgDay: 40, maxDoseMg: 400, days: 3, minAgeYears: 0.5 },
    warnings: NSAID_WARNINGS, interactions: NSAID_INTERACTIONS,
    indication: "Dolor e inflamación posoperatoria, pulpitis, dolor dental. Evidencia de mejor analgesia dental que el acetaminofén solo.",
    instructions: "Tomar con alimentos. Suspender si hay dolor de estómago, heces oscuras o ronchas.",
  },
  {
    id: "naproxeno", dci: "Naproxeno sódico", atc: "M01AE02", group: "Antiinflamatorio (AINE)", classes: ["ains", "naproxeno"],
    presentations: [P("tab550", "Tableta 550 mg", "tableta", "550 mg", "tableta", "Oral", "550", { mgPerUnit: 550 })],
    adult: { units: 1, everyHours: 12, days: 3, note: "Máximo 1.100 mg al día" },
    warnings: [...NSAID_WARNINGS, { tag: "age_lt_8", level: "stop", text: "No indicado en menores de 12 años para uso odontológico habitual", maxAge: 12 }],
    interactions: NSAID_INTERACTIONS,
    indication: "Dolor e inflamación posoperatoria con una toma cada 12 horas.",
    instructions: "Tomar con alimentos.",
  },
  {
    id: "diclofenaco", dci: "Diclofenaco potásico", atc: "M01AB05", group: "Antiinflamatorio (AINE)", classes: ["ains", "diclofenaco"],
    presentations: [P("tab50", "Tableta 50 mg", "tableta", "50 mg", "tableta", "Oral", "50", { mgPerUnit: 50 })],
    adult: { units: 1, everyHours: 8, days: 3, note: "Máximo 150 mg al día" },
    warnings: [...NSAID_WARNINGS, { tag: "cardiac", level: "stop", text: "Cardiopatía: el diclofenaco tiene el mayor riesgo cardiovascular entre los AINES" }],
    interactions: NSAID_INTERACTIONS,
    indication: "Dolor e inflamación posoperatoria en adultos.",
    instructions: "Tomar con alimentos.",
  },
  {
    id: "dexametasona", dci: "Dexametasona", atc: "H02AB02", group: "Corticoide", classes: ["corticoide"],
    presentations: [P("tab4", "Tableta 4 mg", "tableta", "4 mg", "tableta", "Oral", "4", { mgPerUnit: 4 })],
    adult: { units: 1, everyHours: 24, days: 2, note: "4 a 8 mg una vez al día en la mañana por 2 a 3 días (cirugía de terceros molares)" },
    warnings: [
      { tag: "diabetes", level: "warn", text: "Diabetes: puede subir la glucosa; vigilar" },
      { tag: "hypertension", level: "warn", text: "Hipertensión: puede subir la tensión" },
      { tag: "pregnancy", level: "warn", text: "Embarazo: usar solo si el beneficio lo justifica" },
    ],
    interactions: [{ drugs: /warfarina|acenocumarol/i, level: "warn", text: "Puede alterar el efecto de la warfarina" }],
    indication: "Disminuir el edema y el trismus tras cirugía oral (p. ej. terceros molares).",
    instructions: "Tomar en la mañana con comida.",
  },
  {
    id: "amoxicilina", dci: "Amoxicilina", atc: "J01CA04", group: "Antibiótico", classes: ["penicilina", "betalactamico"],
    presentations: [
      P("cap500", "Cápsula 500 mg", "capsula", "500 mg", "cápsula", "Oral", "500", { mgPerUnit: 500 }),
      P("tab875", "Tableta 875 mg", "tableta", "875 mg", "tableta", "Oral", "875", { mgPerUnit: 875 }),
      P("susp250", "Suspensión oral 250 mg/5 mL", "suspension", "250 mg/5 mL", "mL", "Oral", "250", { mgPerMl: 50, bottleMl: 100 }),
    ],
    adult: { units: 1, everyHours: 8, days: 7 },
    ped: { mgPerKgDay: 45, divided: 3, maxMgPerKgDay: 90, maxDoseMg: 500, days: 7 },
    warnings: [
      { tag: "allergy_penicillin", level: "stop", text: "Alergia a penicilinas o antibióticos referida" },
      { tag: "renal", level: "warn", text: "Enfermedad renal: ajustar la dosis" },
    ],
    interactions: [
      { drugs: /warfarina|acenocumarol/i, level: "warn", text: "Puede aumentar el INR; vigilar" },
      { drugs: /metotrexato/i, level: "stop", text: "Aumenta la toxicidad del metotrexato" },
      { drugs: /anticonceptiv|etinilestradiol|levonorgestrel/i, level: "warn", text: "Informar posible menor eficacia de anticonceptivos orales" },
    ],
    indication: "Infecciones odontogénicas (absceso periapical, pericoronitis, celulitis), cirugía en pacientes de riesgo y profilaxis de endocarditis.",
    instructions: "Completar todo el tratamiento aunque mejoren los síntomas.",
  },
  {
    id: "amoxiclav", dci: "Amoxicilina + ácido clavulánico", atc: "J01CR02", group: "Antibiótico", classes: ["penicilina", "betalactamico"],
    presentations: [
      P("tab875", "Tableta 875 mg / 125 mg", "tableta", "875 mg/125 mg", "tableta", "Oral", "875", { mgPerUnit: 875 }),
      P("susp400", "Suspensión oral 400 mg/57 mg por 5 mL", "suspension", "400 mg/57 mg por 5 mL", "mL", "Oral", "400", { mgPerMl: 80, bottleMl: 70 }),
    ],
    adult: { units: 1, everyHours: 12, days: 7 },
    ped: { mgPerKgDay: 45, divided: 2, maxMgPerKgDay: 90, maxDoseMg: 875, days: 7 },
    warnings: [
      { tag: "allergy_penicillin", level: "stop", text: "Alergia a penicilinas o antibióticos referida" },
      { tag: "hepatic", level: "warn", text: "Enfermedad hepática: puede causar daño hepático; evaluar" },
      { tag: "renal", level: "warn", text: "Enfermedad renal: ajustar la dosis" },
    ],
    interactions: [{ drugs: /warfarina|acenocumarol/i, level: "warn", text: "Puede aumentar el INR; vigilar" }, { drugs: /metotrexato/i, level: "stop", text: "Aumenta la toxicidad del metotrexato" }],
    indication: "Infección odontogénica que no mejora con amoxicilina, o con riesgo de microorganismos productores de betalactamasas.",
    instructions: "Tomar al inicio de la comida. Completar el tratamiento.",
  },
  {
    id: "azitromicina", dci: "Azitromicina", atc: "J01FA10", group: "Antibiótico", classes: ["macrolido"],
    presentations: [
      P("tab500", "Tableta 500 mg", "tableta", "500 mg", "tableta", "Oral", "500", { mgPerUnit: 500 }),
      P("susp200", "Suspensión oral 200 mg/5 mL", "suspension", "200 mg/5 mL", "mL", "Oral", "200", { mgPerMl: 40, bottleMl: 15 }),
    ],
    adult: { units: 1, everyHours: 24, days: 3, note: "500 mg una vez al día por 3 días" },
    ped: { mgPerKgDay: 10, divided: 1, maxDoseMg: 500, days: 3 },
    warnings: [
      { tag: "allergy_other", level: "stop", text: "Alergia a macrólidos referida" },
      { tag: "hepatic", level: "warn", text: "Enfermedad hepática: usar con cuidado" },
      { tag: "cardiac", level: "warn", text: "Cardiopatía o arritmias: puede alargar el QT" },
    ],
    interactions: [{ drugs: /warfarina|acenocumarol/i, level: "warn", text: "Puede aumentar el INR; vigilar" }, { drugs: /amiodarona|sotalol|haloperidol|citalopram/i, level: "stop", text: "Riesgo de arritmia por prolongación del QT" }],
    indication: "Alternativa en alergia a penicilina. También profilaxis de endocarditis en alérgicos (500 mg una vez, 30 a 60 minutos antes).",
    instructions: "Tomar una hora antes o dos horas después de las comidas.",
  },
  {
    id: "clindamicina", dci: "Clindamicina", atc: "J01FF01", group: "Antibiótico", classes: ["lincosamida"],
    presentations: [P("cap300", "Cápsula 300 mg", "capsula", "300 mg", "cápsula", "Oral", "300", { mgPerUnit: 300 })],
    adult: { units: 1, everyHours: 8, days: 7 },
    ped: { mgPerKgDay: 20, divided: 3, maxMgPerKgDay: 30, maxDoseMg: 300, days: 7 },
    warnings: [
      { tag: "allergy_other", level: "stop", text: "Alergia a clindamicina o lincosamidas referida" },
      { tag: "gi_bleed", level: "warn", text: "Antecedente de colitis o enfermedad intestinal: riesgo de colitis por C. difficile" },
    ],
    interactions: [],
    indication: "Infección odontogénica en alérgicos a penicilina. Suspender y consultar si aparece diarrea intensa.",
    instructions: "Tomar con un vaso grande de agua. Si hay diarrea intensa o con sangre, suspender y consultar.",
  },
  {
    id: "metronidazol", dci: "Metronidazol", atc: "P01AB01", group: "Antibiótico", classes: ["nitroimidazol"],
    presentations: [P("tab500", "Tableta 500 mg", "tableta", "500 mg", "tableta", "Oral", "500", { mgPerUnit: 500 })],
    adult: { units: 1, everyHours: 8, days: 7 },
    ped: { mgPerKgDay: 30, divided: 3, maxDoseMg: 500, days: 7 },
    warnings: [
      { tag: "pregnancy", level: "warn", text: "Embarazo: evitar en el primer trimestre" },
      { tag: "hepatic", level: "warn", text: "Enfermedad hepática: reducir la dosis" },
      { tag: "epilepsy", level: "warn", text: "Epilepsia: puede causar neurotoxicidad; usar con cuidado" },
      { tag: "allergy_other", level: "stop", text: "Alergia a nitroimidazoles referida" },
    ],
    interactions: [
      { drugs: /warfarina|acenocumarol/i, level: "stop", text: "Aumenta mucho el INR con warfarina" },
      { drugs: /alcohol|disulfiram/i, level: "stop", text: "Reacción con alcohol o disulfiram" },
      { drugs: /litio/i, level: "warn", text: "Puede aumentar los niveles de litio" },
    ],
    indication: "Asociado a amoxicilina en infecciones mixtas, periodontitis agresiva o absceso con anaerobios.",
    instructions: "No consumir alcohol durante el tratamiento ni hasta 48 horas después. Puede dar sabor metálico.",
  },
  {
    id: "cefalexina", dci: "Cefalexina", atc: "J01DB01", group: "Antibiótico", classes: ["cefalosporina", "betalactamico"],
    presentations: [
      P("cap500", "Cápsula 500 mg", "capsula", "500 mg", "cápsula", "Oral", "500", { mgPerUnit: 500 }),
      P("susp250", "Suspensión oral 250 mg/5 mL", "suspension", "250 mg/5 mL", "mL", "Oral", "250", { mgPerMl: 50, bottleMl: 100 }),
    ],
    adult: { units: 1, everyHours: 6, days: 7 },
    ped: { mgPerKgDay: 40, divided: 4, maxMgPerKgDay: 50, maxDoseMg: 500, days: 7 },
    warnings: [
      { tag: "allergy_penicillin", level: "warn", text: "Alergia a penicilinas: hay riesgo de reacción cruzada; evitar si fue anafilaxia" },
      { tag: "renal", level: "warn", text: "Enfermedad renal: ajustar la dosis" },
    ],
    interactions: [{ drugs: /metformina/i, level: "warn", text: "Puede aumentar los niveles de metformina" }],
    indication: "Alternativa a la amoxicilina en infecciones odontogénicas leves.",
    instructions: "Completar el tratamiento.",
  },
  {
    id: "doxiciclina", dci: "Doxiciclina", atc: "J01AA02", group: "Antibiótico", classes: ["tetraciclina"],
    presentations: [P("tab100", "Tableta 100 mg", "tableta", "100 mg", "tableta", "Oral", "100", { mgPerUnit: 100 })],
    adult: { units: 1, everyHours: 12, days: 7, note: "Primer día 200 mg y luego 100 mg al día según indicación" },
    warnings: [
      { tag: "pregnancy", level: "stop", text: "Embarazo: contraindicada (afecta huesos y dientes del feto)" },
      { tag: "age_lt_8", level: "stop", text: "Menores de 8 años: contraindicada (mancha los dientes)" },
      { tag: "allergy_other", level: "stop", text: "Alergia a tetraciclinas referida" },
    ],
    interactions: [{ drugs: /warfarina|acenocumarol/i, level: "warn", text: "Puede aumentar el INR" }, { drugs: /isotretino[ií]na|acitretina/i, level: "stop", text: "Riesgo de hipertensión intracraneal" }, { drugs: /antiácido|calcio|hierro|magnesio/i, level: "warn", text: "Separar 2 horas de antiácidos, calcio, hierro o magnesio" }],
    indication: "Periodontitis (coadyuvante) en adultos.",
    instructions: "Tomar con abundante agua y sin acostarse enseguida. Evitar el sol intenso.",
  },
  {
    id: "nistatina", dci: "Nistatina", atc: "A07AA02", group: "Antifúngico", classes: ["antifungico"],
    presentations: [P("susp100", "Suspensión oral 100.000 UI/mL", "suspension", "100.000 UI/mL", "mL", "Oral (enjuague y tragar)", "100", { bottleMl: 60, cumRegex: "10[.,]?000[.,]?000|100[.,]?000\\s*(UI|U\\.I)" })],
    adult: { mlPerDose: 5, everyHours: 6, days: 10, doseText: "5 mL" },
    pedSameAsAdult: true,
    warnings: [{ tag: "allergy_other", level: "stop", text: "Alergia a nistatina referida" }],
    interactions: [],
    indication: "Candidiasis oral (estomatitis protésica, muguet).",
    instructions: "Mantener en la boca unos minutos antes de tragar. Limpiar y desinfectar la prótesis.",
  },
  {
    id: "fluconazol", dci: "Fluconazol", atc: "J02AC01", group: "Antifúngico", classes: ["azol"],
    presentations: [P("cap150", "Cápsula 150 mg", "capsula", "150 mg", "cápsula", "Oral", "150", { mgPerUnit: 150 }), P("cap100", "Cápsula 100 mg", "capsula", "100 mg", "cápsula", "Oral", "100", { mgPerUnit: 100 })],
    adult: { units: 1, everyHours: 24, days: 7, note: "100 mg al día por 7 a 14 días en candidiasis orofaríngea" },
    warnings: [
      { tag: "pregnancy", level: "stop", text: "Embarazo: evitar" },
      { tag: "hepatic", level: "warn", text: "Enfermedad hepática: usar con cuidado" },
      { tag: "allergy_other", level: "stop", text: "Alergia a azoles referida" },
    ],
    interactions: [
      { drugs: /warfarina|acenocumarol/i, level: "stop", text: "Aumenta mucho el efecto de la warfarina" },
      { drugs: /simvastatina|atorvastatina|amiodarona|sildenafil/i, level: "warn", text: "Interacción con estatinas, amiodarona o sildenafil" },
    ],
    indication: "Candidiasis oral extensa o que no responde a nistatina.",
    instructions: "Tomar a la misma hora cada día.",
  },
  {
    id: "aciclovir", dci: "Aciclovir", atc: "J05AB01", group: "Antiviral", classes: ["antiviral"],
    presentations: [P("tab400", "Tableta 400 mg", "tableta", "400 mg", "tableta", "Oral", "400", { mgPerUnit: 400 }), P("crema5", "Crema 5 %", "crema", "5 %", "aplicación", "Tópica", "5", { bottleMl: 5, atc: "D06BB03" })],
    adult: { units: 1, everyHours: 8, days: 5 },
    warnings: [{ tag: "renal", level: "warn", text: "Enfermedad renal: ajustar la dosis y mantener buena hidratación" }],
    interactions: [],
    indication: "Herpes labial o gingivoestomatitis herpética: iniciar en las primeras 48 horas.",
    instructions: "Iniciar lo antes posible. Tomar con abundante agua.",
  },
  {
    id: "clorhexidina", dci: "Clorhexidina digluconato 0,12 % (enjuague bucal)", atc: "A01AB03", group: "Antiséptico / tópico", classes: ["clorhexidina"],
    presentations: [P("enj012", "Enjuague bucal 0,12 %", "enjuague", "0,12 %", "mL", "Enjuague bucal", "0.12", { bottleMl: 250, cumStrength: "0,12", cumNote: "Los enjuagues bucales suelen estar registrados como productos de higiene oral y no aparecen en el CUM de medicamentos: verifica el registro del producto que dispensan." })],
    adult: { mlPerDose: 15, timesPerDay: 2, days: 10, doseText: "15 mL" },
    warnings: [{ tag: "allergy_other", level: "stop", text: "Alergia a clorhexidina referida" }],
    interactions: [],
    pedSameAsAdult: true,
    indication: "Control químico de placa tras cirugía, alveolitis, periodontitis o gingivitis. No más de 2 semanas seguidas.",
    instructions: "Enjuagar 30 segundos, 2 veces al día, después de cepillar; no tragar; no comer ni beber por 30 minutos. Puede manchar los dientes de forma temporal.",
  },
  {
    id: "benzidamina", dci: "Benzidamina clorhidrato 0,15 % (enjuague bucal)", atc: "A01AD02", group: "Antiséptico / tópico", classes: ["ains_topico"],
    presentations: [P("enj015", "Enjuague bucal 0,15 %", "enjuague", "0,15 %", "mL", "Enjuague bucal", "0.15", { bottleMl: 250, cumStrength: "0,15" })],
    adult: { mlPerDose: 15, timesPerDay: 3, days: 7, doseText: "15 mL" },
    warnings: [{ tag: "allergy_nsaid", level: "warn", text: "Alergia a AINES: la benzidamina es un AINE tópico; usar con cuidado" }, { tag: "age_lt_8", level: "stop", text: "No indicada en menores de 6 años", maxAge: 6 }],
    interactions: [],
    indication: "Dolor y molestia de la mucosa oral tras cirugía o por aftas, mucositis o irritación.",
    instructions: "Enjuagar o hacer gárgaras 30 segundos y escupir.",
  },
  {
    id: "lidocaina_gel", dci: "Lidocaína clorhidrato 2 % (gel viscoso)", atc: "N01BB02", group: "Antiséptico / tópico", classes: ["anestesico"],
    presentations: [P("gel2", "Gel oral 2 %", "gel", "2 %", "aplicación", "Tópica oral", "2", { bottleMl: 30, cumNote: "No se encontró lidocaína 2 % en gel solo de uso oral vigente en el CUM: confirma la disponibilidad en la farmacia." })],
    adult: { doseText: "Una pequeña cantidad", timesPerDay: 4, days: 5 },
    warnings: [{ tag: "allergy_other", level: "stop", text: "Alergia a anestésicos locales referida" }],
    interactions: [],
    indication: "Alivio breve del dolor de úlceras y llagas de la boca.",
    instructions: "Aplicar sobre la lesión con un copito o el dedo limpio, sin tragar; no comer ni beber por 30 minutos.",
  },
  {
    id: "triamcinolona", dci: "Triamcinolona acetónido 0,1 % (pasta oral)", atc: "A01AC01", group: "Corticoide", classes: ["corticoide"],
    presentations: [P("pasta01", "Pasta dental adhesiva 0,1 %", "crema", "0,1 %", "aplicación", "Tópica oral", "0.1", { bottleMl: 5, cumStrength: "0,1", atc: "A01AC01", cumNote: "La triamcinolona 0,1 % para mucosa oral puede estar poco disponible: confirma en la farmacia." })],
    adult: { doseText: "Capa fina sobre la lesión", timesPerDay: 3, days: 7 },
    warnings: [{ tag: "diabetes", level: "warn", text: "Diabetes: uso tópico corto; vigilar infecciones por hongos" }],
    interactions: [],
    pedSameAsAdult: true,
    indication: "Estomatitis aftosa recurrente, liquen plano oral y úlceras traumáticas.",
    instructions: "Aplicar con presión suave sobre la lesión seca, después de comer y al acostarse. No frotar.",
  },
  {
    id: "omeprazol", dci: "Omeprazol", atc: "A02BC01", group: "Gastroprotector", classes: ["ibp"],
    presentations: [P("cap20", "Cápsula 20 mg", "capsula", "20 mg", "cápsula", "Oral", "20", { mgPerUnit: 20 })],
    adult: { units: 1, everyHours: 24, days: 5 },
    warnings: [],
    interactions: [{ drugs: /clopidogrel/i, level: "warn", text: "Reduce el efecto del clopidogrel" }],
    indication: "Protección gástrica mientras se usa un AINE o un corticoide.",
    instructions: "Tomar en ayunas, 30 minutos antes del desayuno.",
  },
  {
    id: "tranexamico", dci: "Ácido tranexámico", atc: "B02AA02", group: "Hemostático", classes: ["antifibrinolitico"],
    presentations: [P("tab500", "Tableta 500 mg", "tableta", "500 mg", "tableta", "Oral", "500", { mgPerUnit: 500 })],
    adult: { units: 1, everyHours: 8, days: 3 },
    warnings: [
      { tag: "cardiac", level: "warn", text: "Antecedente de trombosis o enfermedad cardiovascular: contraindicado si hay riesgo trombótico activo" },
      { tag: "renal", level: "warn", text: "Enfermedad renal: ajustar la dosis" },
      { tag: "epilepsy", level: "warn", text: "Epilepsia: riesgo de convulsiones a dosis altas" },
    ],
    interactions: [{ drugs: /anticonceptiv|estr[oó]geno/i, level: "warn", text: "Con estrógenos aumenta el riesgo de trombosis" }],
    indication: "Control del sangrado tras extracciones en personas con trastornos de coagulación (coordinar con su médico).",
    instructions: "Tomar con agua. Consultar si hay dolor o hinchazón en una pierna.",
  },
];

export const drugById = (id: string) => DRUGS.find((d) => d.id === id);

// ---------- Texto y cantidades ----------

const U = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const T = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
export function numberWords(n: number): string {
  if (n < 30) return U[n];
  if (n < 100) return T[Math.floor(n / 10)] + (n % 10 ? ` y ${U[n % 10]}` : "");
  if (n === 100) return "cien";
  if (n < 1000) return `${C[Math.floor(n / 100)]}${n % 100 ? ` ${numberWords(n % 100)}` : ""}`;
  return String(n);
}

const plural = (unit: string, n: number) => (n === 1 ? unit : unit === "mL" ? "mL" : unit.endsWith("n") ? `${unit.replace("ó", "o")}es`.replace("cápsulaes", "cápsulas") : `${unit}s`);

export type DraftItem = {
  drugId: string | null;
  name: string;
  presentationId: string | null;
  concentration: string;
  form: string;
  route: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  quantityText: string;
  instructions: string;
};

const freqText = (r: { everyHours?: number; timesPerDay?: number }) => (r.everyHours ? (r.everyHours === 24 ? "una vez al día" : `cada ${r.everyHours} horas`) : r.timesPerDay ? `${r.timesPerDay} veces al día` : "");
const dosesPerDay = (r: { everyHours?: number; timesPerDay?: number }) => (r.everyHours ? 24 / r.everyHours : r.timesPerDay ?? 1);
const daysText = (d: number) => `${d} ${d === 1 ? "día" : "días"}`;

// Escritura de la cantidad en números y letras según la presentación (frascos, tubos o unidades).
export function quantityTextFor(p: Presentation, q: number): string {
  if (p.form === "suspension" || p.form === "solucion" || p.form === "enjuague") return `${numberWords(q)} (${q}) ${q === 1 ? "frasco" : "frascos"} de ${p.bottleMl ?? ""} mL`.replace(/ de  mL$/, "");
  if (p.form === "gel" || p.form === "crema") return `${numberWords(q)} (${q}) ${q === 1 ? "tubo" : "tubos"}`;
  return `${numberWords(q)} (${q}) ${plural(p.unit, q)}`;
}

// Cantidad total y su escritura en números y letras.
export function quantityFor(p: Presentation, perDoseUnits: number, perDay: number, days: number): { quantity: number; quantityText: string } {
  if (p.form === "suspension" || p.form === "solucion" || p.form === "enjuague") {
    const ml = Math.ceil(perDoseUnits * perDay * days);
    const bottles = Math.max(1, Math.ceil(ml / (p.bottleMl ?? ml)));
    return { quantity: bottles, quantityText: quantityTextFor(p, bottles) };
  }
  if (p.form === "gel" || p.form === "crema") return { quantity: 1, quantityText: quantityTextFor(p, 1) };
  const q = Math.max(1, Math.ceil(perDoseUnits * perDay * days));
  return { quantity: q, quantityText: quantityTextFor(p, q) };
}

// Borrador de renglón con la pauta de adulto de la presentación elegida.
export function draftAdult(d: Drug, p: Presentation): DraftItem {
  const r = d.adult;
  const perDoseUnits = r.mlPerDose ?? r.units ?? 1;
  const perDay = dosesPerDay(r);
  const q = quantityFor(p, perDoseUnits, perDay, r.days);
  const dose = r.doseText ?? `${perDoseUnits} ${plural(p.unit, perDoseUnits)}${p.mgPerUnit ? ` (${perDoseUnits * p.mgPerUnit} mg)` : ""}`;
  return {
    drugId: d.id, name: d.dci, presentationId: p.id, concentration: p.strength, form: p.label.split(" ")[0], route: p.route,
    dose, frequency: freqText(r), duration: daysText(r.days), ...q, instructions: [r.note, d.instructions].filter(Boolean).join(". "),
  };
}

// Borrador pediátrico por peso (mg/kg/día). Devuelve null si el medicamento no tiene pauta pediátrica o falta el peso.
export function draftPediatric(d: Drug, p: Presentation, weightKg: number): DraftItem | null {
  const ped = d.ped;
  if (!ped || !p.mgPerMl || ped.mgPerKgDay <= 0) return null;
  const perDay = ped.divided;
  let mgPerDose = (ped.mgPerKgDay * weightKg) / perDay;
  if (ped.maxMgPerKgDay) mgPerDose = Math.min(mgPerDose, (ped.maxMgPerKgDay * weightKg) / perDay);
  if (ped.maxDoseMg) mgPerDose = Math.min(mgPerDose, ped.maxDoseMg);
  const ml = Math.round((mgPerDose / p.mgPerMl) * 2) / 2; // se redondea a medio mililitro para que se pueda medir
  const q = quantityFor(p, ml, perDay, ped.days);
  return {
    drugId: d.id, name: d.dci, presentationId: p.id, concentration: p.strength, form: "Suspensión", route: p.route,
    dose: `${ml} mL (${Math.round(ml * p.mgPerMl)} mg)`, frequency: perDay === 1 ? "una vez al día" : `cada ${24 / perDay} horas`, duration: daysText(ped.days), ...q,
    instructions: `Dosis calculada para ${weightKg} kg (${ped.mgPerKgDay} mg/kg/día). ${d.instructions}`,
  };
}
