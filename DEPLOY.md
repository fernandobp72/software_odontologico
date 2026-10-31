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

**Modo automático (API de WhatsApp Cloud de Meta), una cuenta por consultorio.** Cada consultorio conecta su propio WhatsApp Business en *Mi consultorio → WhatsApp de recordatorios* (solo administrador): identificador del número, token permanente, nombre e idioma de la plantilla y el interruptor de envío automático. Al guardar se comprueba con Meta que el número y el token sirvan; el token se guarda **cifrado** (AES-256-GCM con `SECRETS_KEY`, o `SESSION_SECRET` si no existe; si esa clave cambia hay que volver a pegar los tokens) y no se vuelve a mostrar. El texto de ayuda de Recordatorios lo ven administración y recepción, no el odontólogo. Los pasos de Meta (cuenta, número, plantilla) los hace el titular de cada consultorio.

1. En Meta se crea una plantilla de categoría *Utilidad*, idioma español, con este cuerpo (cinco variables):
   `Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. Confirma o cancela aquí: {{5}}`
2. Variables de entorno de la aplicación en Coolify (ya no hay credenciales de WhatsApp globales):
   - `APP_URL` dirección pública con HTTPS, sin barra final (ej. `https://odontologia.fjclouds.com`)
   - `CRON_SECRET` una clave larga (`openssl rand -base64 32`)
   - `REMINDER_HOURS_BEFORE` horas de anticipación (por defecto 24)
   - `SECRETS_KEY` (opcional) clave para cifrar los tokens de los consultorios
3. En Coolify crea una *Scheduled Task* cada 30 minutos con:
   `curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders`

El envío automático **no se ha probado contra la API real** (faltan credenciales); verifica con una cita de prueba antes de activarlo.

# Varios consultorios (SaaS)

- **Registro abierto:** `/registro` crea un consultorio nuevo (30 días de prueba) con su administrador. Para cerrarlo define `ALLOW_SIGNUP=false`.
- **Dueño de la plataforma (cuenta separada):** define `SEED_PLATFORM_EMAIL` (si el correo ya está registrado como consultorio sin pacientes se convierte; si no existe, también `SEED_PLATFORM_PASSWORD`; opcional `SEED_PLATFORM_NAME`). Se crea en un consultorio interno `system` y, al entrar, solo ve *Clientes* (consultorios, estado, suspender, dar prueba) y *Mi cuenta*; las pantallas clínicas lo devuelven a Clientes. Al crearla se retira el permiso de plataforma de cualquier otra cuenta (`SEED_PLATFORM_ADMIN` queda solo como compatibilidad y se ignora si hay `SEED_PLATFORM_EMAIL`). Para atender pacientes usa una cuenta de consultorio con otro correo.
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

Reglas actuales (`src/lib/suggest.ts`), revisadas con el criterio del usuario — **deben ser validadas por un odontólogo antes de usarse con pacientes**:

| Hallazgo | Diagnóstico | Procedimiento sugerido |
|---|---|---|
| Caries de **esmalte** | K02.0 | Flúor en gel y control a los 3–6 meses (no restauración) |
| Caries de **dentina** | K02.1 | Obturación en resina, una por superficie (fase 2) |
| Fractura | S02.5 | Obturación en resina (fase 1, urgencia) |
| Diente ausente (excepto terceros molares) | K08.1 | — |
| Retenido / impactado | K01.1 | Exodoncia de diente incluido: valorar con panorámica si hay síntomas o afecta al vecino |
| Parcialmente erupcionado | K00.6 | Solo si hay caries distal en el segundo molar vecino: exodoncia quirúrgica |
| Endodoncia en premolar o molar | — | Corona definitiva, material **zirconio** por defecto (fase 3) |
| Endodoncia en diente anterior | — | «Restauración definitiva (por definir)»: el odontólogo elige resina, corona, etc. |
| Pérdida de inserción (NIC ≥ 3 mm con sondaje ≥ 4 mm) en 2 o más dientes (criterio 2017) | K05.3 | Detartraje subgingival por cuadrante, supragingival, educación en higiene y reevaluación |
| Sangrado ≥ 10 % sin pérdida de inserción en 2 dientes | K05.1 | Detartraje supragingival y educación en higiene |
| Recesión ≥ 3 mm en un diente | K06.0 | — |

- Los procedimientos con material (corona, prótesis, perno, muñón, implante) permiten elegirlo; el material sale en la cuenta de cobro.
- Las sugerencias nuevas van siempre a un plan en borrador: nunca cambian un presupuesto ya presentado o aceptado.
- El valor unitario se toma del último precio usado en el consultorio para el mismo procedimiento (si no hay, queda en 0).
- Solo se eliminan procedimientos pendientes; lo realizado se conserva en la historia. Un plan se elimina solo si no se aceptó ni tiene procedimientos realizados.

# Catálogo y tarifas por consultorio

- **Dónde:** menú *Catálogo* (solo administrador). Cada consultorio recibe el catálogo base (unos 50 procedimientos con CUPS) la primera vez que se necesita, todo activo y con tarifa 0.
- **Qué define cada consultorio:** si ofrece el procedimiento, su tarifa base y sus materiales (cada uno con su precio y uno por defecto). Si un material tiene precio, reemplaza a la tarifa base. También puede crear procedimientos propios y subir o bajar todas las tarifas un porcentaje (por grupo o en total).
- **Dónde se usa:**
  - Al agregar un procedimiento al plan solo aparecen los activos, y el valor se rellena solo según procedimiento y material (editable).
  - Las sugerencias automáticas toman el precio y el material por defecto del catálogo del consultorio; si un procedimiento sugerido está desactivado, se agrega igual con un aviso.
  - Al definir una «restauración por definir» (dientes anteriores con endodoncia) se ofrecen únicamente las restauraciones activas del consultorio.
- **Pendiente:** tarifas por convenio/EPS y por sede; importar tarifas desde una hoja de cálculo.

## Tarifas de referencia

En *Catálogo* el botón **Cargar tarifas de referencia** completa las tarifas de unos 30 procedimientos con precios típicos de odontología privada en Colombia (octubre de 2026). Solo toca lo que está en 0: nunca cambia una tarifa que el consultorio ya definió. La tabla está en `src/lib/reference-prices.ts`; parte sale de sitios comparadores de precios (sin fuente oficial) y parte son estimaciones, así que cada consultorio debe ajustarlas a su ciudad y mercado (hay un botón para subir o bajar todo un porcentaje). Los materiales sin precio propio (p. ej. disilicato de litio) usan la tarifa base de la corona.

# Imagen de Docker liviana

El `Dockerfile` usa tres etapas para que cada despliegue ocupe poco disco en el servidor (que es compartido): `build` compila con todas las dependencias y genera el paquete autónomo de Next (`output: "standalone"`, ~130 MB); `tools` instala aparte `prisma`, `tsx` y `bcryptjs` solo para migrar la base y crear el usuario inicial; `runtime` lleva únicamente el paquete autónomo y esas herramientas (~325 MB, contra ~850 MB antes). Las migraciones se aplican con `prisma migrate deploy` y el servidor arranca con `node server.js`. La configuración de Next está en `next.config.mjs`.

Si el servidor vuelve a quedarse sin espacio, hay que activar el *Docker Cleanup* programado de Coolify (por ejemplo con umbral de disco del 70 %).

# Evolución automática desde lo realizado

En la ficha del paciente, al marcar en «Nueva evolución» los procedimientos del plan realizados hoy, la nota se redacta sola con procedimiento, diente, superficies, material y diagnóstico del diente (`src/lib/evolution-text.ts`), y se completan el diagnóstico CIE-10 y el CUPS. Todo es editable; lo que el profesional escribe o dicta se conserva al marcar o desmarcar. El sistema solo redacta datos que ya conoce: frases como la anestesia o las complicaciones las elige el profesional (botones de frases rápidas). Al firmar, los procedimientos marcados quedan como realizados y enlazados a la evolución.

## Formulario previo del paciente

En Historia clínica → "Formulario previo del paciente" el profesional crea un enlace (`/formulario/<token>`, vence en 7 días, un solo envío; en la base solo se guarda el hash) y lo manda por WhatsApp. El paciente contesta en lenguaje sencillo (motivo, antecedentes, alergias, medicamentos, hábitos), autoriza el tratamiento de datos (Ley 1581, texto borrador por revisar legalmente) y firma con el dedo. El profesional pulsa "Revisar y cargar en la valoración": las respuestas se mezclan con la valoración vigente (sin borrar lo existente), las corrige y al guardar queda una versión nueva y el formulario marcado como revisado. Lo del paciente nunca entra solo a la historia clínica.

## Comandos de voz (sin IA)

En el odontograma ("Dictar hallazgos") y el periodontograma ("Dictar sondaje") el navegador convierte la voz en texto (Chrome/Edge/Safari) y `src/lib/voice.ts` lo interpreta con reglas y vocabulario fijo; lo que no entiende se muestra como aviso y no se adivina. También hay un campo para escribir el mismo comando (sirve donde no hay reconocimiento de voz).
- Odontograma (arriba el vestibular va hacia afuera y el palatino hacia la línea central; abajo se invierte: lingual hacia la línea central): «diente 16 oclusal mesial caries de dentina», «diente 26 mod obturación», «ausentes 18 28 38 48», «diente 46 endodoncia diente 47 corona». Los estados sin superficie (corona, endodoncia, ausente…) afectan todo el diente; las caries y obturaciones exigen la superficie. Cada frase se aplica de una vez y un solo «Deshacer» la revierte.
- Periodontograma: «diente 18 vestibular 3 2 4 palatino 4 3 3» (los valores van por los 6 sitios, de izquierda a derecha como en el teclado y de a uno, 0 a 9), «sangra» / «placa» (el último sitio), «recesión 1 0 2», «menos 1», «ausente», «movilidad 2», «furca 1», «supuración». Los números de diente se dicen después de la palabra «diente».

Seguimiento del dictado en el odontograma: al decir «diente 15» el diente queda marcado de inmediato (también con resultados parciales, antes de terminar la frase) y las frases siguientes se aplican a él: «oclusal mesial» (se recuerdan las superficies) y luego «caries de dentina»; o «caries» y luego «oclusal». Un diente nuevo reinicia lo pendiente.

## Administración de plataforma (cuenta de plataforma)

- **Clientes** (`/plataforma`): lista de consultorios con su administrador, estado, prueba y acciones rápidas. Cada cliente tiene una **ficha** (`/plataforma/<id>`) con datos de contacto, uso (pacientes, citas y evoluciones de 30 días, imágenes y MB, usuarios y sedes activos, última entrada) y la lista de personas y sedes. Solo conteos y tamaños: nunca contenido clínico.
- **Soporte** desde la ficha: enlace de restablecimiento de contraseña (24 h, un solo uso; nunca se ve ni se fija una contraseña), cambiar el correo de una persona, desactivar/reactivar usuarios y anular invitaciones pendientes. No hay modo «entrar como» el cliente, a propósito.
- **Actividad** (`/plataforma/actividad`): registro de cada acción de plataforma (quién, qué, cuándo) sobre `AuditLog`, que no se edita.
- `User.lastLoginAt` se guarda en cada ingreso; en desarrollo `allowedDevOrigins` permite abrir el servidor por 127.0.0.1.

## Eliminar y nombre del centro

- **Eliminar desde plataforma** (ficha del cliente): una persona se elimina solo si no dejó registros (evoluciones, cobros, imágenes…); si los dejó se desactiva. Un cliente se elimina solo si **no tiene pacientes**, escribiendo su nombre exacto; con pacientes no se borra (la historia clínica se conserva por ley, Res. 839 de 2017) y se suspende. No se puede eliminar al único administrador activo. Todo queda en *Actividad*.
- **Nombre del centro:** `Clinic.noun` (`consultorio`, `clinica` o `centro`) se elige al registrarse y se cambia en *Mi consultorio*; las pantallas internas lo usan con su artículo (`src/lib/noun.ts`). Las pantallas públicas y de pacientes usan textos neutros.

- **Eliminar un paciente de prueba:** en la ficha del paciente, solo el administrador (sección «Eliminar paciente de prueba»): exige marcar que es de prueba y escribir su documento; borra todo lo registrado (odontograma, historia, evoluciones, plan, consentimientos, imágenes, citas). Si tiene recibos o cuentas de cobro no se elimina. Queda en la auditoría. La historia clínica de pacientes reales no se borra (Res. 839 de 2017).

## Logo del consultorio

*Mi consultorio → Logo* (solo administrador): acepta JPG, PNG, WebP, GIF, AVIF, TIFF o SVG de hasta 15 MB; el servidor (`sharp`, `src/lib/logo.ts`) lo orienta, lo reduce a máximo 512 px, lo convierte a WebP con transparencia y baja la calidad solo lo necesario para quedar en unos 60 KB. Se guarda en `Clinic.logo` y se sirve en `/api/logo/<id>` con caché (es imagen de marca, sin sesión). Se muestra en el menú, los recibos, las cuentas de cobro, la confirmación de cita y el formulario previo del paciente. Un SVG que referencia archivos externos se rechaza.

## Correo de la plataforma y recuperación de contraseña

- **Configurar:** cuenta de plataforma → *Correo*: servidor SMTP, puerto, usuario, contraseña (cifrada, no se vuelve a mostrar), nombre y correo del remitente. Al guardar se comprueba la conexión y la autenticación, y hay un botón «Enviarme una prueba». Sirve cualquier proveedor con SMTP (Brevo, Resend, Amazon SES, Zoho, Mailgun, Gmail con contraseña de aplicación). Para que no caiga en spam, usa un remitente de tu dominio con SPF y DKIM configurados en el proveedor.
- **Recuperar contraseña:** `/olvide` (enlace «¿Olvidaste tu contraseña?» en el login). Envía un enlace de un solo uso que vence en 1 hora; responde igual exista o no el correo y limita los intentos. Sirve para todas las cuentas, incluida la de plataforma. Sin correo configurado, el administrador sigue pudiendo generar el enlace a mano en Equipo.
- **Invitaciones y enlaces por correo:** Equipo (casilla «Enviar la invitación por correo» y botón «Enviar por correo» para restablecer) y la ficha del cliente en plataforma (soporte).
- **Comunicados:** cuenta de plataforma → *Comunicados*: asunto y mensaje a todos los clientes o solo activos, en prueba o suspendidos; un correo por administrador activo (tope 300 por envío), anotado en *Actividad*.
- **Si se pierde la contraseña de la cuenta de plataforma y no hay correo:** en Coolify define `SEED_PLATFORM_EMAIL`, `SEED_PLATFORM_PASSWORD` y `SEED_RESET=1`, redespliega, entra, y luego borra `SEED_PLATFORM_PASSWORD` y `SEED_RESET`.
- Los formularios de ingreso y de registro conservan lo escrito (menos la contraseña) cuando hay un error, y el ingreso tiene «Mostrar la contraseña».

## Política de privacidad (URL pública)

`/privacidad` (por ejemplo `https://odontologia.fjclouds.com/privacidad`) es la política de privacidad y tratamiento de datos, pública y sin sesión; es la URL que pide Meta para publicar la app de WhatsApp y también sirve como instrucciones de eliminación de datos (`/privacidad#eliminacion`). Variables opcionales: `LEGAL_NAME` (razón social del titular) y `CONTACT_EMAIL` (correo de contacto para privacidad y eliminación de datos). El texto es una base razonable pero debe revisarlo asesoría jurídica antes de darlo por definitivo.

## Fórmula médica y vademécum

- **Dónde:** pestaña *Fórmulas* del paciente (odontólogo y administrador) y menú *Vademécum*. La fórmula se arma sola a partir de lo realizado en los últimos 7 días (exodoncias, cirugía, endodoncia, periodoncia, abscesos) y de los diagnósticos activos (alveolitis, aftas, candidiasis, herpes), y se puede cambiar, quitar o ampliar desde el vademécum o escribiendo a mano. Al firmar, queda inmutable y numerada por consultorio; se anula con motivo (no se edita) y se imprime en `/formula/<id>` con los datos que pide el Decreto 2200 de 2005 (denominación común, concentración, forma, dosis, vía, frecuencia, duración y cantidad en números y letras, y registro del prescriptor).
- **Registro profesional:** cada odontólogo lo guarda en *Mi cuenta* (RETHUS o tarjeta profesional); sin él no puede firmar.
- **Alertas** (`src/lib/rx-rules.ts`): cruzan la valoración (alergias, enfermedades, embarazo, medicamentos que toma), la edad y el peso. Las de bloqueo (⛔: p. ej. penicilina con alergia, AINES en embarazo o con anticoagulantes) excluyen el medicamento de la fórmula automática y, si se agrega a mano, obligan a escribir un motivo para firmar; el servidor vuelve a calcularlas al firmar. En menores se calcula la dosis por peso (mg/kg/día) y se piden el peso si falta.
- **Vademécum** (`src/lib/vademecum.ts`, versión `VADEMECUM_VERSION`): ~30 medicamentos de uso odontológico con dosis de adulto y niño, advertencias e interacciones. No incluye medicamentos de control especial (opioides, benzodiacepinas). Es apoyo a la decisión y **debe ser validado por un odontólogo clínico y un químico farmacéutico** antes del uso con pacientes reales; revisarlo al menos una vez al año.
- **Actualización con el INVIMA** (`src/lib/invima.ts`): cada presentación se contrasta con el CUM vigente (datos abiertos de datos.gov.co, conjunto `i7cb-raxc`: registro vigente y presentación activa). El resultado se guarda por código ATC y se renueva cada 30 días; si el servicio no responde se usa la copia guardada. Los enjuagues y geles de higiene oral pueden no figurar en el CUM de medicamentos (se avisa).

- **Corregir nombres:** cada persona edita su nombre (y su registro profesional si es clínica) en *Mi cuenta → Mis datos*; el administrador corrige el de cualquiera en *Equipo → Corregir nombre*. El nombre se muestra en las evoluciones y fórmulas (se lee del usuario), así que un cambio se refleja también en lo ya firmado; queda en la auditoría.

- **Datos de pacientes y profesionales:** el alta de pacientes pide también segundo nombre y apellido, fecha de nacimiento, sexo, dirección, ciudad, ocupación, régimen y acompañante; todos se corrigen desde la ficha (*Editar datos*, cualquier rol, queda en la auditoría) y la edad se muestra en el encabezado. Los profesionales tienen celular (*Mi cuenta → Mis datos*); el correo de ingreso se cambia en *Mi cuenta* con la contraseña actual, y el administrador edita nombre, correo, celular y registro de cualquiera en *Equipo → Editar datos de la persona*.

## Dictado por voz en el celular

`src/lib/speech-controller.ts` (probado con un reconocedor simulado) maneja el reconocimiento del navegador: en iPhone/iPad usa una sola sesión continua y entrega cada frase una vez; en Android y escritorio escucha frase por frase y descarta las repeticiones de Chrome. Al terminar una sesión reinicia tras una pausa corta; si no logra volver a escuchar lo dice («Toca para seguir escuchando», porque el navegador exige un toque) y si falta el permiso del micrófono muestra el motivo. El botón indica el estado real («Preparando micrófono…», «● Escuchando…»). Lo usan la evolución, el odontograma y el periodontograma. En iPhone el campo de comandos también acepta el dictado del teclado. Falta confirmarlo en equipos reales: Safari y Chrome varían entre versiones.

## Revisión de pantallas en el celular

Se midió con Chrome simulando 320, 360, 375 y 414 px (desbordes de página, texto que se sale de su caja, controles superpuestos y tamaño táctil), con montos grandes y nombres largos. Correcciones: tarjetas de montos de la cuenta del paciente (se apilan en pantallas angostas), resumen del paciente (ya no se ensancha con correos largos), agenda (fecha y hora a todo el ancho), selector de rol de Equipo (se veía vacío y diminuto: la lista de roles se leía de un módulo de cliente y llegaba vacía al servidor; ahora vive en `src/lib/roles.ts`), botones de sangrado y placa del periodontograma, encabezado del odontograma, zonas táctiles de los desplegables y áreas seguras de iPhone (`viewport-fit=cover` y márgenes `env(safe-area-inset-bottom)` en la barra inferior). Red de seguridad: `overflow-x: clip` en `html` y `body` para que la página no se desplace de lado.
