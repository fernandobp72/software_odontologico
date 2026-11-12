import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <h1 className="page-title">No encontramos lo que buscas</h1>
      <p className="text-slate-800">Puede que el enlace esté mal escrito, que el registro sea de otra sede o consultorio, o que ya no exista.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/pacientes" className="btn-primary">Buscar paciente</Link>
        <Link href="/agenda" className="btn-secondary">Ir a la agenda</Link>
      </div>
    </div>
  );
}
