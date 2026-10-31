"use client";

import { DOC_TYPES, REGIMES, SEX } from "@/lib/patient-fields";

export type PatientValues = {
  documentType?: string; documentNumber?: string; firstName?: string; middleName?: string; lastName?: string; secondLastName?: string;
  birthDate?: string; sex?: string; phone?: string; email?: string; address?: string; city?: string; eps?: string; regime?: string;
  occupation?: string; companionName?: string; companionPhone?: string; companionKin?: string; allergies?: string;
};

// Campos de identificación y contacto, comunes al alta y a la edición.
export default function PatientFields({ v = {} }: { v?: PatientValues }) {
  const t = (name: keyof PatientValues, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="label">{label}<input name={name} defaultValue={v[name] ?? ""} className="field" {...extra} /></label>
  );
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <label className="label">Tipo
          <select name="documentType" defaultValue={v.documentType ?? "CC"} className="field">{DOC_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <label className="label col-span-2">Número<input name="documentNumber" inputMode="numeric" required defaultValue={v.documentNumber ?? ""} className="field" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {t("firstName", "Primer nombre", { required: true })}
        {t("middleName", "Segundo nombre")}
        {t("lastName", "Primer apellido", { required: true })}
        {t("secondLastName", "Segundo apellido")}
        <label className="label">Fecha de nacimiento<input name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={v.birthDate ?? ""} className="field" /></label>
        <label className="label">Sexo
          <select name="sex" defaultValue={v.sex ?? ""} className="field"><option value="">—</option>{SEX.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        {t("phone", "Celular", { type: "tel", inputMode: "tel" })}
        {t("email", "Correo", { type: "email" })}
        {t("address", "Dirección")}
        {t("city", "Ciudad")}
        {t("occupation", "Ocupación")}
        {t("eps", "EPS")}
        <label className="label">Régimen
          <select name="regime" defaultValue={v.regime ?? ""} className="field"><option value="">—</option>{REGIMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        {t("allergies", "Alergias (resumen)")}
      </div>
      <fieldset className="space-y-3 rounded-lg border border-slate-300 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-900">Acompañante o responsable (menores de edad)</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {t("companionName", "Nombre")}
          {t("companionKin", "Parentesco")}
          {t("companionPhone", "Celular", { type: "tel", inputMode: "tel" })}
        </div>
      </fieldset>
    </>
  );
}
