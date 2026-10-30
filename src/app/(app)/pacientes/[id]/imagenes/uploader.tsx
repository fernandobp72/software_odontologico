"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QUADRANTS } from "@/lib/catalogs";
import { IMAGE_KINDS } from "@/lib/images";

const TEETH = QUADRANTS.flat().sort((a, b) => a - b);
const today = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

// Reduce la imagen en el dispositivo (acelera la subida desde el celular) y genera la miniatura.
async function shrink(file: File, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality));
  return { blob, width: w, height: h };
}

export default function Uploader({ patientId }: { patientId: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string }>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = (fd.getAll("source") as File[]).find((f) => f.size > 0);
    if (!file) return setMsg({ error: "Elige un archivo o toma una foto" });
    setBusy(true);
    setMsg(undefined);
    try {
      const out = new FormData();
      for (const k of ["kind", "tooth", "takenAt", "note"]) out.set(k, String(fd.get(k) ?? ""));
      if (file.type.startsWith("image/")) {
        const main = await shrink(file, 2600, 0.9);
        const thumb = await shrink(file, 360, 0.7);
        out.set("file", new File([main.blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        out.set("thumb", new File([thumb.blob], "thumb.jpg", { type: "image/jpeg" }));
        out.set("width", String(main.width));
        out.set("height", String(main.height));
      } else {
        out.set("file", file);
      }
      const res = await fetch(`/api/pacientes/${patientId}/imagenes`, { method: "POST", body: out });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo subir el archivo");
      form.current?.reset();
      setMsg({ ok: true });
      router.refresh();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "Error al subir" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} className="card space-y-4">
      <h2 className="section-title">Subir radiografía o foto</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Archivo (foto, imagen o PDF)
          <input name="source" type="file" accept="image/*,application/pdf" className="field file:mr-3 file:rounded file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-white" />
        </label>
        <label className="label">O tomar foto con la cámara
          <input name="source" type="file" accept="image/*" capture="environment" className="field file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">Tipo
          <select name="kind" className="field" defaultValue="PERIAPICAL">{Object.entries(IMAGE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="label">Diente
          <select name="tooth" className="field" defaultValue=""><option value="">—</option>{TEETH.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="label">Fecha de toma<input name="takenAt" type="date" defaultValue={today()} max={today()} required className="field" /></label>
      </div>
      <label className="label">Nota (opcional)<input name="note" maxLength={300} className="field" /></label>
      {msg?.error && <p role="alert" className="error-text">{msg.error}</p>}
      {msg?.ok && <p className="ok-text">Archivo guardado</p>}
      <button disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? "Subiendo…" : "Subir"}</button>
      <p className="muted">Las imágenes se reducen en tu dispositivo antes de subir. Máximo 10 MB. No se pueden borrar: solo anular con motivo.</p>
    </form>
  );
}
