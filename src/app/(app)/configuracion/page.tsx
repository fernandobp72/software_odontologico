import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import ClinicForm, { WhatsappForm } from "./form";

export default async function ConfiguracionPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo administración puede ver esta sección.</p>;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { name: true, nit: true, address: true, phone: true, whatsappPhoneId: true, whatsappToken: true, whatsappTemplate: true, whatsappLang: true, whatsappAuto: true } });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Mi consultorio</h1>
      <ClinicForm clinic={clinic} />
      <WhatsappForm wa={{ phoneId: clinic.whatsappPhoneId, hasToken: !!clinic.whatsappToken, template: clinic.whatsappTemplate, lang: clinic.whatsappLang, auto: clinic.whatsappAuto }} />
    </div>
  );
}
