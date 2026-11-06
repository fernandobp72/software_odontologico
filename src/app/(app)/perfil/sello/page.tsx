import { requireUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { selloState } from "@/lib/signing";
import { AddDevice, PinForm } from "./forms";
import { revokeMine } from "./actions";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const REASON: Record<string, string> = { LOST: "Reportado perdido o robado", CHANGED: "Cambiado por otro dispositivo", ADMIN: "Retirado por el administrador" };

export default async function SelloPage() {
  const user = await requireUser();
  if (user.role === "RECEPTION") redirect("/perfil");
  const [creds, st, me] = await Promise.all([
    db.signingCredential.findMany({ where: { userId: user.id }, orderBy: { serial: "asc" } }),
    selloState(user.id, user.clinicId),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sealGeneration: true, licenseNumber: true } }),
  ]);
  const active = creds.filter((c) => !c.revokedAt);
  const past = creds.filter((c) => c.revokedAt);
  const canAdd = !st.hadAny || st.hasActive || st.grant;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Mi sello digital</h1>
        <p className="muted max-w-2xl">Es como tu sello físico, pero personal e imposible de copiar: cada evolución y fórmula que firmas queda amarrada a tu dispositivo (tu huella, rostro o clave), no solo a tu sesión. {me.sealGeneration > 0 ? `Sello reexpedido ${me.sealGeneration} ${me.sealGeneration === 1 ? "vez" : "veces"}.` : ""}</p>
      </div>
      {!me.licenseNumber && <p role="alert" className="card max-w-lg border-amber-600 bg-amber-50 text-amber-900">Registra tu registro profesional en <a className="underline" href="/perfil">Mis datos</a> para poder crear tu sello.</p>}
      {st.required && !st.hasActive && <p role="alert" className="card max-w-lg border-red-700 bg-red-50 font-semibold text-red-900">Tu consultorio exige firmar con sello. Sin un dispositivo activo no podrás firmar evoluciones ni fórmulas.</p>}
      {!st.hasActive && st.hadAny && !st.grant && <p role="alert" className="card max-w-lg border-red-700 bg-red-50 text-red-900">No tienes dispositivos activos. Pídele al administrador que autorice un sello nuevo (Equipo → «Autorizar sello nuevo»); mientras tanto no podrás crear uno.</p>}
      {active.length === 1 && <p className="card max-w-lg border-amber-600 bg-amber-50 text-sm text-amber-900">Solo tienes un dispositivo. Agrega un respaldo (otro aparato o tu clave de firma): si pierdes este, podrás seguir firmando y retirarlo tú mismo.</p>}

      <section className="space-y-2">
        <h2 className="section-title">Dispositivos activos</h2>
        {active.length === 0 && <p className="card max-w-lg text-slate-700">{st.hadAny ? "No tienes dispositivos activos, así que no puedes firmar hasta tener un sello nuevo." : "Todavía no tienes sello. Mientras no lo crees, tus firmas quedan respaldadas solo por tu sesión."}</p>}
        <ul className="space-y-3">
          {active.map((c) => (
            <li key={c.id} className="card max-w-lg space-y-2">
              <p className="font-semibold text-slate-900">Sello N.º {c.serial} · {c.label}</p>
              <p className="muted">{c.kind === "PIN" ? "Clave de firma" : `Llave del dispositivo${c.backedUp ? " (copiada en tu cuenta de Apple/Google)" : ""}`} · creado {fmt.format(c.createdAt)} · {c.lastUsedAt ? `último uso ${fmt.format(c.lastUsedAt)}` : "sin usar"}</p>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-red-800">Perdí este dispositivo o lo voy a cambiar</summary>
                <div className="mt-2 space-y-2">
                  <p className="muted">Se anula ya mismo y nadie podrá firmar con él. Las firmas anteriores siguen siendo válidas.</p>
                  <form action={revokeMine.bind(null, c.id, "LOST")} className="space-y-2">
                    <label className="label">Tu contraseña<input type="password" name="password" required autoComplete="current-password" className="field" /></label>
                    <label className="label">Se perdió o me lo robaron. ¿Desde qué día? (si lo sabes)<input type="date" name="since" max={new Date().toISOString().slice(0, 10)} className="field" /></label>
                    <button className="btn-danger min-h-10">Reportar pérdida o robo</button>
                  </form>
                  <form action={revokeMine.bind(null, c.id, "CHANGED")} className="space-y-2"><label className="label">Tu contraseña<input type="password" name="password" required autoComplete="current-password" className="field" /></label><button className="btn-secondary min-h-10">Solo lo cambié por otro</button></form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {canAdd && <AddDevice first={!st.hasActive} hasGrant={st.grant} />}
      {canAdd && !st.hasPin && <PinForm first={!st.hasActive} />}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Historial de tu sello</h2>
          <ul className="card max-w-lg divide-y divide-slate-200 p-0">
            {past.map((c) => (
              <li key={c.id} className="px-4 py-3 text-sm text-slate-900">
                <p className="font-semibold">Sello N.º {c.serial} · {c.label}</p>
                <p className="muted">{REASON[c.revokedReason ?? ""] ?? "Retirado"} el {fmt.format(c.revokedAt!)}{c.compromisedSince ? ` · posible uso indebido desde ${fmt.format(c.compromisedSince)}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
