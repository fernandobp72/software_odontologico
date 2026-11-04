import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { nounOf } from "@/lib/noun";
import sharp from "sharp";
import IconForm from "./icon-form";
import LogoForm from "./logo-form";
import ClinicForm, { WhatsappForm } from "./form";

export default async function ConfiguracionPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo administración puede ver esta sección.</p>;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { name: true, noun: true, logo: true, logoUpdatedAt: true, iconColor: true, nit: true, address: true, phone: true, whatsappPhoneId: true, whatsappToken: true, whatsappTemplate: true, whatsappLang: true, whatsappAuto: true } });
  const meta = clinic.logo ? await sharp(Buffer.from(clinic.logo)).metadata().catch(() => null) : null;
  const v = `${clinic.logoUpdatedAt?.getTime() ?? 0}${clinic.iconColor ? clinic.iconColor.slice(1) : ""}`;
  return (
    <div className="space-y-4">
      <h1 className="page-title">Mi {nounOf(clinic.noun).name}</h1>
      <LogoForm clinicId={user.clinicId} version={clinic.logoUpdatedAt?.getTime() ?? null} />
      <IconForm clinicId={user.clinicId} v={v} color={clinic.iconColor} logoSize={meta?.width && meta.height ? { w: meta.width, h: meta.height } : null} />
      <ClinicForm clinic={{ name: clinic.name, noun: clinic.noun, nit: clinic.nit, address: clinic.address, phone: clinic.phone }} />
      <WhatsappForm noun={nounOf(clinic.noun).name} wa={{ phoneId: clinic.whatsappPhoneId, hasToken: !!clinic.whatsappToken, template: clinic.whatsappTemplate, lang: clinic.whatsappLang, auto: clinic.whatsappAuto }} />
    </div>
  );
}
