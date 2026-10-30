import { db } from "@/lib/db";
import { respond } from "./actions";

export const metadata = { title: "Confirmar cita", robots: { index: false } };

export default async function ConfirmarPage({ params }: PageProps<"/confirmar/[token]">) {
  const { token } = await params;
  const a = await db.appointment.findUnique({ where: { confirmToken: token }, include: { clinic: true, patient: { select: { firstName: true } } } });
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm space-y-4 p-6 text-center">
        {!a || a.startsAt < new Date() ? (
          <>
            <h1 className="text-xl font-bold">Enlace no disponible</h1>
            <p className="text-slate-700">Este enlace no existe o la cita ya pasó. Comunícate con el consultorio si necesitas ayuda.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-teal-800">{a.clinic.name}</p>
            <h1 className="text-xl font-bold">Hola {a.patient.firstName}</h1>
            <p className="text-lg first-letter:uppercase text-slate-900">{fmt.format(a.startsAt)}</p>
            {a.status === "CONFIRMED" && <p className="ok-text">Tu cita está confirmada. ¡Te esperamos!</p>}
            {a.status === "CANCELLED" && <p className="error-text">Cancelaste esta cita. Comunícate con el consultorio para reprogramar.</p>}
            {(a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
              <div className="space-y-2">
                {a.status === "SCHEDULED" && <form action={respond.bind(null, token, "CONFIRMED")}><button className="btn-primary w-full">Confirmar mi cita</button></form>}
                <form action={respond.bind(null, token, "CANCELLED")}><button className="btn-danger w-full">No podré asistir</button></form>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
