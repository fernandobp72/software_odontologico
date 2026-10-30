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

# Copias de seguridad y restauración

- **Programación:** Coolify → base `odontologico-db` → *Backups*: copia diaria a las 03:00 (hora del servidor), formato `pg_dump -Fc`, conserva las últimas 14 copias (máximo 30 días). Se verificó una ejecución exitosa.
- **Dónde quedan:** en el servidor (`/data/coolify/backups/databases/...`) y, además, en el depósito S3 externo de Oracle (`oracle free`, depósito `storage-personal`), con la misma retención (14 copias / 30 días). Se verificó listando el depósito: el archivo llegó con el mismo tamaño. Si se pierde el servidor, las copias siguen en Oracle.
- **Restaurar en una base nueva (sin tocar producción):**
  1. Copia el archivo `.dmp` desde el servidor (o descárgalo desde Coolify).
  2. `createdb odontologico_restaurada`
  3. `pg_restore --no-owner -d odontologico_restaurada archivo.dmp`
  4. Revisa los datos (`select count(*) from "Patient";`).
- **Restaurar producción:** detén la aplicación en Coolify, restaura en la base y vuelve a iniciarla. Hazlo siempre primero en una base de prueba.
- Ensayo del procedimiento: se restauró un volcado y coincidieron pacientes y migraciones.
- Pendiente: hacer un ensayo mensual con una copia real de producción.

# Diagnósticos y plan automáticos desde los hallazgos

Al abrir *Diagnósticos y plan* por primera vez en un paciente que ya tiene hallazgos, el sistema genera solo los diagnósticos y un plan **borrador** a partir del odontograma y del último periodontograma. Todo queda marcado como «Sugerido» y se puede modificar, eliminar o complementar. Si luego aparecen hallazgos nuevos, una tarjeta ofrece agregarlos; lo que el odontólogo editó no se toca y lo que eliminó no vuelve.

Reglas actuales (`src/lib/suggest.ts`) — **deben ser revisadas por un odontólogo antes de usarse con pacientes**:

| Hallazgo | Diagnóstico | Procedimiento sugerido |
|---|---|---|
| Caries en superficies | K02.1 (ajustar a K02.0 si es solo esmalte) | Obturación en resina, una por superficie (fase 2) |
| Fractura | S02.5 | Obturación en resina (fase 1, urgencia) |
| Diente ausente | K08.1 | — |
| Endodoncia | — | Corona definitiva (fase 3) |
| Sondaje ≥ 4 mm en 4 o más sitios y NIC ≥ 3 mm | K05.3 | Detartraje subgingival por cuadrante, supragingival, educación en higiene y reevaluación (fases 2 y 4) |
| Sangrado al sondaje ≥ 10 % sin pérdida de inserción | K05.1 | Detartraje supragingival y educación en higiene |
| Recesión ≥ 3 mm en un diente | K06.0 | — |

- Las sugerencias nuevas van siempre a un plan en borrador: nunca cambian un presupuesto ya presentado o aceptado.
- El valor unitario se toma del último precio usado en el consultorio para el mismo procedimiento (si no hay, queda en 0).
- Solo se eliminan procedimientos pendientes; lo realizado se conserva en la historia. Un plan se elimina solo si no se aceptó ni tiene procedimientos realizados.
