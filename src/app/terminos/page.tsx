export const metadata = { title: "Términos y política de datos" };

// BORRADOR: debe ser reemplazado por textos revisados por asesoría jurídica antes de publicar el servicio.
export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 bg-white p-6 text-slate-900">
      <p className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Texto en borrador pendiente de revisión jurídica.</p>
      <h1 className="text-2xl font-bold">Términos del servicio</h1>
      <p>Este servicio permite a consultorios y clínicas odontológicas gestionar agenda, historia clínica, cobros y comunicación con sus pacientes.</p>
      <h2 className="text-lg font-bold">Responsabilidad sobre los datos</h2>
      <p>Cada consultorio es el responsable del tratamiento de los datos personales de sus pacientes y debe contar con su autorización (Ley 1581 de 2012). El proveedor del software actúa como encargado del tratamiento: los almacena y protege siguiendo las instrucciones del consultorio, no los usa para otros fines y no los comparte con otros consultorios.</p>
      <h2 className="text-lg font-bold">Historia clínica</h2>
      <p>La historia clínica es reservada y de custodia del prestador de salud. Los registros firmados no se modifican; las correcciones se hacen por nuevas anotaciones.</p>
      <h2 className="text-lg font-bold">Cuenta y uso</h2>
      <p>El administrador del consultorio responde por los usuarios que invita y por el uso de sus credenciales. Cada persona debe usar su propia cuenta.</p>
      <h2 className="text-lg font-bold">Privacidad</h2>
      <p>Consulta la <a href="/privacidad" className="font-semibold underline">política de privacidad y tratamiento de datos</a>.</p>
      <h2 className="text-lg font-bold">Facturación electrónica</h2>
      <p>La factura electrónica ante la DIAN se emite con el proveedor tecnológico que el consultorio contrate y habilite; el software no reemplaza esa obligación.</p>
    </main>
  );
}
