"use client";

import { useEffect, useState } from "react";
import type { PatientOption } from "@/lib/patient-fields";
import AppointmentForm from "./form";

// Botón flotante «+» (abajo a la derecha) que abre el formulario de nueva cita.
// Con «autoOpen» (desde la ficha del paciente: «Agendar») el formulario se abre de una vez con el paciente elegido.
export default function NewAppointmentFab({ autoOpen = false, initialPatient = null, ...props }: { autoOpen?: boolean; initialPatient?: PatientOption | null; professionals: { id: string; name: string }[]; defaultDentistId: string | null; defaultDate: string }) {
  const [open, setOpen] = useState(autoOpen);
  const [seed, setSeed] = useState(initialPatient);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => {
    setOpen(false); setRound((r) => r + 1); setSeed(null);
    // Quita «paciente» de la dirección para que al recargar no se vuelva a abrir.
    if (autoOpen) {
      const u = new URL(window.location.href);
      if (u.searchParams.has("paciente")) { u.searchParams.delete("paciente"); window.history.replaceState(null, "", u); }
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Nueva cita" title="Nueva cita"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-3xl font-light leading-none text-white shadow-lg ring-1 ring-teal-900/20 hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900 md:bottom-8 md:right-8 md:h-16 md:w-16">
        <span aria-hidden="true">+</span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Nueva cita" className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">Nueva cita</h2>
              <button type="button" onClick={close} aria-label="Cerrar" className="min-h-11 min-w-11 rounded-lg text-2xl text-slate-700 hover:bg-slate-100">×</button>
            </div>
            <AppointmentForm key={round} {...props} initialPatient={seed} onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}
