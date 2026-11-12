import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 py-12">
      <h1 className="page-title">Página no encontrada</h1>
      <p className="text-slate-800">El enlace no existe o ya venció. Si te lo enviaron por WhatsApp o correo, pide uno nuevo.</p>
      <Link href="/" className="btn-primary">Ir al inicio</Link>
    </main>
  );
}
