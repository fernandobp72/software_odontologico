import { requirePlatformAdmin } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";
import BroadcastForm from "./form";

export default async function ComunicadosPage() {
  await requirePlatformAdmin();
  const ready = await mailConfigured();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Comunicados</h1>
        <p className="muted max-w-2xl">Información general para tus clientes: novedades, mantenimientos, cambios de precios. Llega por correo a los administradores de cada consultorio o clínica.</p>
      </div>
      {ready ? <BroadcastForm /> : <p className="card max-w-xl">Primero configura el correo de la plataforma en el menú <strong>Correo</strong>.</p>}
    </div>
  );
}
