import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import MailForm from "./form";

export default async function CorreoPage() {
  await requirePlatformAdmin();
  const c = await db.emailConfig.findUnique({ where: { id: "main" } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Correo de la plataforma</h1>
        <p className="muted max-w-2xl">Con esta conexión la plataforma envía a tus clientes los correos de <strong>recuperación de contraseña</strong>, las <strong>invitaciones</strong> a su equipo y los <strong>comunicados</strong>. {c ? "Está configurada." : "Aún no está configurada: mientras tanto nadie puede recuperar su contraseña por correo."}</p>
      </div>
      <MailForm cfg={c ? { host: c.host, port: c.port, secure: c.secure, username: c.username, hasPassword: !!c.passwordEnc, fromName: c.fromName, fromEmail: c.fromEmail } : null} />
    </div>
  );
}
