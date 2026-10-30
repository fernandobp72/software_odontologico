# Despliegue en Coolify

1. En Coolify: **New Resource → Database → PostgreSQL**. Copia la *Internal URL* (postgres://…).
2. **New Resource → Application → repositorio Git**, build pack **Dockerfile**, puerto **3000**.
3. Variables de entorno de la aplicación (runtime):
   - `DATABASE_URL` = la Internal URL del paso 1
   - `SESSION_SECRET` = `openssl rand -base64 32`
4. Dominio: asigna uno con HTTPS (Coolify genera el certificado). La sesión usa cookie `secure` en producción, así que el sitio debe servirse por HTTPS.
5. Deploy. Las migraciones se aplican solas al arrancar.
6. Primer usuario (una sola vez), desde la terminal de la app en Coolify:
   `SEED_EMAIL=tu@correo.com SEED_NAME="Tu Nombre" SEED_PASSWORD='<contraseña>' npx prisma db seed`
7. En el celular abre el dominio y usa "Agregar a pantalla de inicio" para instalarla como app.

# Recordatorios por WhatsApp

**Modo manual (funciona sin configurar nada).** En *Agenda → Recordatorios por WhatsApp* se listan las citas de las próximas 72 horas. Cada botón abre WhatsApp con el mensaje ya escrito. Solo se ofrece a pacientes que autorizaron recordatorios (Ley 1581 de 2012). El mensaje no incluye datos de salud y trae un enlace público para que el paciente confirme o cancele (`/confirmar/<token>`).

**Modo automático (API de WhatsApp Cloud de Meta).** Requiere una cuenta de WhatsApp Business, un número y una plantilla aprobada. Los pasos de Meta los hace el titular de la cuenta.

1. En Meta crea una plantilla de categoría *Utilidad*, idioma español, con este cuerpo (cinco variables):
   `Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. Confirma o cancela aquí: {{5}}`
2. Variables de entorno de la aplicación en Coolify:
   - `WHATSAPP_TOKEN` token permanente de la API
   - `WHATSAPP_PHONE_ID` identificador del número
   - `WHATSAPP_TEMPLATE` nombre de la plantilla (por defecto `recordatorio_cita`)
   - `WHATSAPP_TEMPLATE_LANG` código de idioma de la plantilla (por defecto `es`)
   - `APP_URL` dirección pública con HTTPS, sin barra final (ej. `https://odontologico.fjclouds.com`)
   - `CRON_SECRET` una clave larga (`openssl rand -base64 32`)
   - `REMINDER_HOURS_BEFORE` horas de anticipación (por defecto 24)
3. En Coolify crea una *Scheduled Task* cada 30 minutos con:
   `curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders`

El envío automático **no se ha probado contra la API real** (faltan credenciales); verifica con una cita de prueba antes de activarlo.

# Varios consultorios (SaaS)

- **Registro abierto:** `/registro` crea un consultorio nuevo (30 días de prueba) con su administrador. Para cerrarlo define `ALLOW_SIGNUP=false`.
- **Dueño de la plataforma:** define `SEED_PLATFORM_ADMIN=1` junto con `SEED_EMAIL` y `SEED_PASSWORD`; esa cuenta ve el menú *Plataforma* (consultorios, estado, suspender, dar prueba). Solo ve cuentas y conteos, nunca datos clínicos.
- **Equipo:** el administrador de cada consultorio invita por enlace (válido 7 días, un solo uso) y puede generar enlaces para restablecer contraseñas.
- **Aislamiento:** todas las consultas se filtran por consultorio; un consultorio suspendido solo ve la pantalla de suspensión.
- **Pendiente antes de vender:** términos y política de datos revisados por un abogado (hoy son un borrador), verificación de correo, cobro de suscripciones y sucursales.

# Sedes

- Cada consultorio tiene al menos una sede ("Sede principal", creada al registrarse o por la migración). El administrador crea más en *Sedes*.
- **Compartido por todo el consultorio:** pacientes, historia clínica, planes, cuenta del paciente y cuentas de cobro.
- **Por sede:** agenda, caja (una caja abierta por sede) y recordatorios. El recibo muestra la sede donde se cobró.
- Cada persona entra solo a las sedes asignadas en *Equipo*; el administrador entra a todas. Quien tiene más de una ve un selector de sede.
- Pendiente: reportes consolidados y por sede, y pacientes asignados a una sede de origen.
