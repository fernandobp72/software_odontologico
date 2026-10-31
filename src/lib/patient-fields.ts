import { z } from "zod";

export const DOC_TYPES = ["CC", "TI", "CE", "RC", "PA", "PT"] as const;
export const SEX = [["F", "Femenino"], ["M", "Masculino"], ["O", "Otro"]] as const;
export const REGIMES = [["CONTRIBUTIVO", "Contributivo"], ["SUBSIDIADO", "Subsidiado"], ["PARTICULAR", "Particular"]] as const;

const opt = (max: number) => z.string().trim().max(max).optional();

// Datos de identificación y contacto del paciente. Los mismos campos sirven para crear y para corregir.
export const patientSchema = z.object({
  documentType: z.enum(DOC_TYPES),
  documentNumber: z.string().trim().min(3, "Documento inválido").max(30),
  firstName: z.string().trim().min(1, "Falta el nombre").max(80),
  middleName: opt(80),
  lastName: z.string().trim().min(1, "Falta el apellido").max(80),
  secondLastName: opt(80),
  birthDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Date.parse(v)) && new Date(v) <= new Date() && new Date(v).getFullYear() >= 1900), "Fecha de nacimiento inválida"),
  sex: z.enum(["F", "M", "O", ""]).optional(),
  phone: opt(30),
  email: z.union([z.literal(""), z.string().trim().email("Correo inválido").max(120)]).optional(),
  address: opt(160),
  city: opt(80),
  eps: opt(80),
  regime: z.enum(["CONTRIBUTIVO", "SUBSIDIADO", "PARTICULAR", ""]).optional(),
  occupation: opt(80),
  companionName: opt(120),
  companionPhone: opt(30),
  companionKin: opt(60),
  allergies: opt(300),
});
export type PatientInput = z.infer<typeof patientSchema>;

// La fecha se guarda a mediodía UTC para que no cambie de día por la zona horaria.
export const toBirthDate = (v?: string) => (v ? new Date(`${v}T12:00:00Z`) : null);
export const birthInputValue = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export function dataFor(d: PatientInput) {
  const n = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    documentType: d.documentType, documentNumber: d.documentNumber, firstName: d.firstName, lastName: d.lastName,
    middleName: n(d.middleName), secondLastName: n(d.secondLastName), birthDate: toBirthDate(d.birthDate), sex: n(d.sex),
    phone: n(d.phone), email: n(d.email), address: n(d.address), city: n(d.city), eps: n(d.eps), regime: n(d.regime),
    occupation: n(d.occupation), companionName: n(d.companionName), companionPhone: n(d.companionPhone), companionKin: n(d.companionKin), allergies: n(d.allergies),
  };
}

export const ageFrom = (birth: Date | null | undefined, at = new Date()) => {
  if (!birth) return null;
  let a = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) a--;
  return a;
};
export const ageText = (birth: Date | null | undefined) => {
  const a = ageFrom(birth);
  if (a === null) return null;
  if (a >= 2) return `${a} años`;
  const months = Math.max(0, (new Date().getUTCFullYear() - birth!.getUTCFullYear()) * 12 + new Date().getUTCMonth() - birth!.getUTCMonth());
  return `${months} ${months === 1 ? "mes" : "meses"}`;
};
