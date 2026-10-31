export const metadata = { title: "Política de privacidad y tratamiento de datos" };

const UPDATED = "31 de octubre de 2026";

// Contacto y razón social se definen con variables de entorno (LEGAL_NAME, CONTACT_EMAIL) para no dejar datos escritos en el código.
export default function PrivacidadPage() {
  const owner = process.env.LEGAL_NAME || "el titular de la plataforma Odontología";
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-white p-6 text-slate-900">
      <h1 className="text-2xl font-bold">Política de privacidad y tratamiento de datos personales</h1>
      <p className="muted">Última actualización: {UPDATED}</p>

      <p>
        Esta política explica cómo se tratan los datos personales en <strong>Odontología</strong>, una plataforma web para que consultorios, clínicas y profesionales de la odontología gestionen su agenda, historia clínica, cobros y comunicación con sus pacientes. Se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas colombianas sobre protección de datos.
      </p>

      <h2 className="text-lg font-bold">1. Quién es responsable de los datos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Cada consultorio o clínica</strong> que usa la plataforma es el <strong>responsable del tratamiento</strong> de los datos de sus pacientes y de su historia clínica. Es quien decide para qué se usan y quien debe contar con la autorización de cada paciente.</li>
        <li><strong>{owner}</strong> actúa como <strong>encargado del tratamiento</strong> de esos datos: los almacena y protege siguiendo las instrucciones del consultorio, no los usa para fines propios y no los comparte con otros consultorios. Respecto de los datos de las cuentas de los usuarios (profesionales y administradores) actúa como responsable.</li>
      </ul>

      <h2 className="text-lg font-bold">2. Qué datos se tratan</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Usuarios de la plataforma:</strong> nombre, correo electrónico, rol, registro profesional (si lo informan), fecha de ingreso y registros de actividad.</li>
        <li><strong>Pacientes (por cuenta del consultorio):</strong> identificación, datos de contacto, aseguradora, antecedentes, odontograma, periodontograma, diagnósticos, planes de tratamiento, evoluciones, consentimientos firmados, imágenes y radiografías, y datos de pagos. Son datos sensibles de salud, tratados con las reservas que exige la ley.</li>
        <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de seguridad necesarios para proteger el servicio.</li>
      </ul>

      <h2 className="text-lg font-bold">3. Para qué se usan</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Prestar el servicio: agenda, historia clínica, cobros, imágenes, reportes y administración del equipo.</li>
        <li>Autenticar a los usuarios y proteger las cuentas (por ejemplo, correos de recuperación de contraseña e invitaciones).</li>
        <li>Enviar a los pacientes recordatorios de citas y enlaces para confirmar o cancelar, y a los administradores comunicados del servicio.</li>
        <li>Cumplir obligaciones legales y atender requerimientos de autoridades competentes.</li>
      </ul>

      <h2 className="text-lg font-bold">4. Mensajes por WhatsApp</h2>
      <p>
        Cada consultorio puede conectar su propia cuenta de WhatsApp Business (API de WhatsApp de Meta) para enviar recordatorios de citas. Estos mensajes <strong>solo se envían a pacientes que autorizaron expresamente recibirlos</strong>, contienen únicamente el nombre, el nombre del consultorio, la fecha y la hora de la cita y un enlace para confirmarla o cancelarla, y <strong>no incluyen datos de salud</strong> (diagnósticos, tratamientos ni motivos de consulta). Para enviarlos se comparte con Meta el número de celular del paciente y el texto del mensaje, que Meta trata según sus propias políticas. El paciente puede retirar su autorización en cualquier momento pidiéndolo al consultorio o respondiendo que no desea recibir más mensajes.
      </p>

      <h2 className="text-lg font-bold">5. Con quién se comparten los datos</h2>
      <p>
        No se venden ni se ceden datos personales. Solo intervienen proveedores necesarios para operar el servicio (alojamiento y copias de seguridad, envío de correo electrónico y, cuando el consultorio lo activa, la plataforma de WhatsApp de Meta), que están obligados a proteger la información, y las autoridades cuando la ley lo exige.
      </p>

      <h2 className="text-lg font-bold">6. Seguridad</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Conexión cifrada (HTTPS) y contraseñas almacenadas con hash, nunca en texto legible.</li>
        <li>Aislamiento de los datos de cada consultorio: ninguna cuenta puede ver los datos de otro.</li>
        <li>Roles y permisos (administrador, odontólogo, recepción) y registro de auditoría de las acciones relevantes.</li>
        <li>Los registros clínicos firmados no se modifican: las correcciones quedan como nuevas anotaciones.</li>
        <li>Los secretos de integración (como el token de WhatsApp) se guardan cifrados, y se hacen copias de seguridad periódicas de la base de datos.</li>
        <li>El personal de la plataforma administra cuentas y uso, pero no accede a la historia clínica de los pacientes de los consultorios.</li>
      </ul>

      <h2 className="text-lg font-bold">7. Conservación</h2>
      <p>
        La historia clínica se conserva por el término que exige la ley colombiana (hoy 15 años, Resolución 839 de 2017), por lo que no puede borrarse antes aunque se cierre una cuenta. Los demás datos se conservan mientras la cuenta esté activa y el tiempo necesario para cumplir obligaciones legales; después se suprimen o anonimizan.
      </p>

      <h2 className="text-lg font-bold">8. Derechos de los titulares</h2>
      <p>
        Toda persona puede conocer, actualizar y rectificar sus datos, solicitar prueba de la autorización, ser informada del uso que se les da, presentar quejas ante la Superintendencia de Industria y Comercio, revocar la autorización y pedir la supresión de sus datos cuando no exista un deber legal de conservarlos. Los pacientes deben dirigir su solicitud al consultorio que los atiende, que es el responsable; la plataforma colabora para atenderla.
      </p>

      <h2 id="eliminacion" className="text-lg font-bold">9. Cómo solicitar la eliminación de tus datos</h2>
      <p>
        Escribe {contact ? <>a <a className="font-semibold underline" href={`mailto:${contact}`}>{contact}</a></> : "al canal de soporte indicado por el consultorio o por la plataforma"} indicando tu nombre, tu número de documento o celular y qué datos quieres eliminar. Responderemos en los plazos de la ley (máximo 15 días hábiles para consultas y reclamos). Los datos de historia clínica que la ley obliga a conservar no se pueden eliminar antes de que venza ese término.
      </p>

      <h2 className="text-lg font-bold">10. Cambios y contacto</h2>
      <p>
        Esta política puede actualizarse; la fecha de la última versión aparece al inicio.{contact ? <> Para consultas sobre privacidad escribe a <a className="font-semibold underline" href={`mailto:${contact}`}>{contact}</a>.</> : null}
      </p>
    </main>
  );
}
