import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { nounOf } from "@/lib/noun";
import LogoForm from "./logo-form";
import ClinicForm, { WhatsappForm } from "./form";

export default async function ConfiguracionPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo administración puede ver esta sección.</p>;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { name: true, noun: true, logoUpdatedAt: true, nit: true, address: true, phone: true, whatsappPhoneId: true, whatsappToken: true, whatsappTemplate: true, whatsappLang: true, whatsappAuto: true } });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Mi {nounOf(clinic.noun).name}</h1>
      <LogoForm clinicId={user.clinicId} version={clinic.logoUpdatedAt?.getTime() ?? null} />
      <ClinicForm clinic={clinic} />
      <WhatsappForm noun={nounOf(clinic.noun).name} wa={{ phoneId: clinic.whatsappPhoneId, hasToken: !!clinic.whatsappToken, template: clinic.whatsappTemplate, lang: clinic.whatsappLang, auto: clinic.whatsappAuto }} />
    </div>
  );
}
