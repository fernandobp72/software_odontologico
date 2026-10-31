import type { AssessmentData } from "./assessment";
import { DRUGS, drugById, draftAdult, draftPediatric, quantityFor, type Drug, type DraftItem, type Presentation, type Tag } from "./vademecum";

// Motor de alertas y de borrador automático de la fórmula. Es apoyo a la decisión: nunca prescribe solo; el odontólogo revisa y firma.

export type RxContext = {
  ageYears: number | null;
  weightKg: number | null;
  assessment: AssessmentData | null;
  doneItems: { name: string; tooth: number | null }[]; // tratamientos realizados recientemente
  diagnoses: { code: string; description: string; tooth: number | null }[];
};

export type Alert = { level: "stop" | "warn"; text: string };

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : []);
const txt = (v: string | string[] | undefined) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : "");

export type Flags = { tags: Set<Tag>; meds: string; allergyText: string; ageYears: number | null };

export function patientFlags(ctx: RxContext): Flags {
  const a = ctx.assessment ?? {};
  const dis = arr(a.enfermedades);
  const alg = arr(a.alergias);
  const tags = new Set<Tag>();
  if (dis.includes("Embarazo")) tags.add("pregnancy");
  if (dis.includes("Enfermedad renal")) tags.add("renal");
  if (dis.includes("Hepatitis")) tags.add("hepatic");
  if (dis.includes("Trastorno de coagulación")) tags.add("coagulation");
  if (dis.includes("Asma / EPOC")) tags.add("asthma");
  if (dis.includes("Hipertensión")) tags.add("hypertension");
  if (dis.includes("Diabetes")) tags.add("diabetes");
  if (dis.includes("Cardiopatía")) tags.add("cardiac");
  if (dis.includes("Epilepsia")) tags.add("epilepsy");
  if (alg.includes("Penicilina / antibióticos")) tags.add("allergy_penicillin");
  if (alg.includes("AINES")) tags.add("allergy_nsaid");
  const meds = strip(`${txt(a.medicamentos)} ${txt(a.cirugias)} ${txt(a.observaciones)}`);
  if (/warfarina|acenocumarol|rivaroxab|apixab|dabigatr|clopidogrel|heparina|enoxaparina|aspirina|acido acetilsalic/.test(meds)) { tags.add("anticoagulant"); tags.add("coagulation"); }
  if (/ulcera|sangrado digestivo|hemorragia digestiva/.test(meds)) tags.add("gi_bleed");
  return { tags, meds, allergyText: strip(`${txt(a.alergiasOtras)} ${alg.includes("Otra") ? "otra" : ""}`), ageYears: ctx.ageYears };
}

// Alergia «otra» escrita a mano: se cruza con el nombre del medicamento y su familia.
function allergyMatches(d: Drug, text: string) {
  if (!text.trim()) return false;
  const names = [strip(d.dci.split(" ")[0]), ...d.classes.map(strip)];
  return names.some((n) => n.length > 3 && text.includes(n)) || (d.classes.includes("ains") && /ains|antiinflamatori|aspirina/.test(text)) || (d.classes.includes("penicilina") && /penicilin|amoxicilin/.test(text));
}

export function alertsFor(d: Drug, f: Flags): Alert[] {
  const out: Alert[] = [];
  for (const w of d.warnings) {
    if (w.tag === "age_lt_8") {
      if (f.ageYears !== null && f.ageYears < (w.maxAge ?? 8)) out.push({ level: w.level, text: w.text });
    } else if (w.tag === "allergy_other") {
      if (allergyMatches(d, f.allergyText)) out.push({ level: w.level, text: w.text });
    } else if (f.tags.has(w.tag)) out.push({ level: w.level, text: w.text });
  }
  for (const i of d.interactions) if (i.drugs.test(f.meds)) out.push({ level: i.level, text: i.text });
  // El campo del formulario dice «Penicilina / antibióticos»: ante otro antibiótico se pide confirmar a cuál es alérgico.
  if (f.tags.has("allergy_penicillin") && d.group === "Antibiótico" && !d.classes.includes("penicilina") && !d.classes.includes("betalactamico")) {
    out.push({ level: "warn", text: "Refirió alergia a «antibióticos»: confirma a cuál antes de formular este" });
  }
  // Cualquier alergia de penicilina que cubra a la familia del medicamento ya se vio arriba; aquí se evita repetir el mismo texto.
  return out.filter((a, i) => out.findIndex((b) => b.text === a.text) === i);
}

export type DraftWithAlerts = DraftItem & { alerts: Alert[]; reason: string };
export type Generated = { items: DraftWithAlerts[]; excluded: { name: string; reason: string }[]; notes: string[]; reasons: string[] };

const has = (names: string[], re: RegExp) => names.some((n) => re.test(strip(n)));
const hasStop = (a: Alert[]) => a.some((x) => x.level === "stop");

export function isPediatric(ctx: RxContext) {
  return (ctx.ageYears !== null && ctx.ageYears < 12) || (ctx.weightKg !== null && ctx.weightKg < 40);
}

function presentationFor(d: Drug, pediatric: boolean, preferId?: string): Presentation {
  const list = d.presentations;
  if (preferId) { const p = list.find((x) => x.id === preferId); if (p) return p; }
  if (pediatric) return list.find((x) => x.mgPerMl || x.form === "enjuague" || x.form === "gel") ?? list[0];
  return list.find((x) => x.form !== "suspension") ?? list[0];
}

export function generate(ctx: RxContext): Generated {
  const f = patientFlags(ctx);
  const ped = isPediatric(ctx);
  const names = ctx.doneItems.map((i) => i.name);
  const dx = ctx.diagnoses.map((d) => d.code);
  const dxText = ctx.diagnoses.map((d) => strip(d.description));
  const items: DraftWithAlerts[] = [];
  const excluded: { name: string; reason: string }[] = [];
  const notes: string[] = [];
  const reasons: string[] = [];

  const surgical = has(names, /quirurg|tercer molar|cordal|incluid|retenid|colgajo|alveoloplast|cirugia|implante|injerto|elevacion de seno/);
  const exo = has(names, /exodoncia|extraccion/);
  const endo = has(names, /endodoncia|conducto|pulpectom|pulpotom|necropulp/) || dx.some((c) => /^K04\.[0-2]/.test(c) || c === "K04.0");
  const perio = has(names, /raspado|alisado|detartraje|periodont|curetaje/) || dx.some((c) => /^K05\.[3-6]/.test(c));
  const abscess = has(names, /absceso|drenaje|celulitis/) || dx.some((c) => /^K04\.[67]/.test(c) || c === "K12.2") || dxText.some((t) => /absceso|celulitis/.test(t));
  const alveolitis = dx.includes("K10.3") || dxText.some((t) => /alveolitis/.test(t));
  const aphthae = dx.some((c) => /^K12\.0/.test(c));
  const candidiasis = dx.some((c) => /^B37\.0/.test(c)) || dxText.some((t) => /candidiasis/.test(t));
  const herpes = dx.some((c) => /^B00\.[12]/.test(c)) || dxText.some((t) => /herpes/.test(t));

  // Agrega un medicamento al borrador si no tiene alertas de bloqueo; si las tiene, queda como excluido con el motivo.
  const add = (drugId: string, reason: string, o: { presentation?: string; days?: number } = {}): boolean => {
    const d = drugById(drugId);
    if (!d) return false;
    if (items.some((i) => i.drugId === drugId)) return true;
    const alerts = alertsFor(d, f);
    if (hasStop(alerts)) {
      excluded.push({ name: d.dci, reason: alerts.filter((a) => a.level === "stop").map((a) => a.text).join("; ") });
      return false;
    }
    const p = presentationFor(d, ped, o.presentation);
    let draft: DraftItem | null;
    if (ped) {
      if (d.pedSameAsAdult) draft = draftAdult(d, p);
      else if (ctx.weightKg === null) { excluded.push({ name: d.dci, reason: "Falta el peso del paciente para calcular la dosis pediátrica" }); return false; }
      else draft = draftPediatric(d, p, ctx.weightKg);
      if (!draft) { excluded.push({ name: d.dci, reason: "Sin pauta pediátrica en el vademécum: formúlalo manualmente si lo consideras necesario" }); return false; }
    } else draft = draftAdult(d, p);
    if (o.days && o.days !== d.adult.days && !ped) {
      const per = d.adult.everyHours ? 24 / d.adult.everyHours : d.adult.timesPerDay ?? 1;
      const units = d.adult.mlPerDose ?? d.adult.units ?? 1;
      draft = { ...draft, duration: `${o.days} ${o.days === 1 ? "día" : "días"}`, ...recompute(p, units, per, o.days) };
    }
    items.push({ ...draft, alerts, reason });
    return true;
  };

  // Primera opción disponible de una lista, para no dejar al paciente sin analgesia si la primera está bloqueada.
  const firstOf = (ids: string[], reason: string, o?: { days?: number }) => {
    for (const id of ids) if (add(id, reason, o)) return true;
    return false;
  };

  const analgesic = (reason: string) => firstOf(["ibuprofeno", "acetaminofen"], reason);
  const antibiotic = (reason: string) => firstOf(["amoxicilina", "clindamicina", "azitromicina"], reason);

  if (exo && !surgical) {
    reasons.push("Exodoncia");
    analgesic("Analgesia tras la exodoncia");
  }
  if (surgical) {
    reasons.push("Cirugía oral / exodoncia quirúrgica");
    analgesic("Analgesia y control de la inflamación tras la cirugía");
    if (!ped) add("dexametasona", "Reducir edema y trismus tras cirugía", { days: 2 });
    if (items.some((i) => i.drugId === "ibuprofeno" || i.drugId === "naproxeno" || i.drugId === "diclofenaco") && f.tags.has("anticoagulant") === false && !ped) {
      // Gastroprotección solo si además se formula corticoide y AINE a la vez.
      if (items.some((i) => i.drugId === "dexametasona")) add("omeprazol", "Protección gástrica con AINE y corticoide", { days: 3 });
    }
    add("clorhexidina", "Control de placa en la zona operada", { days: 7 });
    notes.push("No se formula antibiótico de rutina en cirugía oral sana: agrégalo si hay infección, riesgo de endocarditis o inmunosupresión.");
  }
  if (endo) {
    reasons.push("Tratamiento de conducto / pulpitis");
    analgesic("Dolor posendodóntico o pulpitis");
  }
  if (abscess) {
    reasons.push("Infección odontogénica (absceso / celulitis)");
    analgesic("Dolor por la infección");
    const before = items.length;
    antibiotic("Infección odontogénica");
    if (items.length === before) notes.push("Ningún antibiótico del vademécum es compatible con las alergias o antecedentes: valora remitir o formular manualmente.");
    notes.push("El antibiótico acompaña, no reemplaza, el drenaje o el tratamiento del foco. Si hay fiebre, trismus, dificultad para tragar o respirar, remitir de urgencia.");
  }
  if (perio) {
    reasons.push("Terapia periodontal");
    add("clorhexidina", "Control químico de placa tras la terapia periodontal", { days: 14 });
    notes.push("El antibiótico sistémico en periodontitis solo se usa como coadyuvante en casos agresivos (estadio III–IV, grado C): agrégalo manualmente si lo indicas.");
  }
  if (alveolitis) {
    reasons.push("Alveolitis");
    analgesic("Dolor de la alveolitis");
    add("clorhexidina", "Antiséptico en el alvéolo", { days: 7 });
    notes.push("El tratamiento principal es la irrigación y la curación local del alvéolo; el antibiótico no está indicado de rutina.");
  }
  if (aphthae) {
    reasons.push("Estomatitis aftosa");
    add("triamcinolona", "Estomatitis aftosa");
    add("benzidamina", "Alivio del dolor de la mucosa");
  }
  if (candidiasis) {
    reasons.push("Candidiasis oral");
    firstOf(["nistatina", "fluconazol"], "Candidiasis oral");
  }
  if (herpes) {
    reasons.push("Herpes");
    if (!ped) add("aciclovir", "Herpes labial u oral", { presentation: "tab400" });
  }

  if (!reasons.length) notes.push("Con los tratamientos y diagnósticos registrados no se genera una fórmula automática. Agrega los medicamentos que necesites del vademécum.");
  if (ped && ctx.weightKg === null) notes.push("El paciente es menor y no tiene peso registrado: las dosis por peso no se pudieron calcular. Registra el peso en Historia clínica.");
  if (!ctx.assessment) notes.push("El paciente no tiene valoración registrada: no se pudieron revisar alergias ni antecedentes. Pregúntalos antes de formular.");

  return { items, excluded, notes, reasons };
}

const recompute = quantityFor;

export function searchDrugs(q: string, limit = 12) {
  const n = strip(q.trim());
  if (!n) return DRUGS.slice(0, limit);
  return DRUGS.filter((d) => strip(d.dci).includes(n) || strip(d.group).includes(n) || d.classes.some((c) => c.includes(n)) || strip(d.indication).includes(n)).slice(0, limit);
}
