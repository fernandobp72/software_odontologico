import "server-only";
import sharp, { type OutputInfo } from "sharp";

export const LOGO_MAX_INPUT = 15 * 1024 * 1024;
const MAX_SIDE = 512;
const TARGET_BYTES = 60 * 1024;

export type ProcessedLogo = { data: Buffer; width: number; height: number; bytes: number };

// Cualquier imagen común (JPG, PNG, WebP, GIF, AVIF, TIFF, SVG) pasa a un WebP de máximo 512 px que conserva la
// transparencia y respeta la orientación; la calidad baja solo lo necesario para quedar en unos 60 KB.
export async function processLogo(input: Buffer): Promise<ProcessedLogo> {
  const head = input.subarray(0, 2048).toString("utf8").toLowerCase();
  if (head.includes("<svg") || head.includes("<?xml")) {
    // Un SVG no debe cargar recursos externos: solo se aceptan referencias internas o incrustadas.
    const text = input.toString("utf8");
    if (/(?:xlink:)?href\s*=\s*["'](?!#|data:)/i.test(text) || /<script|<foreignObject|@import|url\(\s*["']?(?!#|data:)/i.test(text)) {
      throw new Error("El SVG referencia archivos externos. Expórtalo como PNG o JPG.");
    }
  }
  const base = sharp(input, { failOn: "error", limitInputPixels: 80_000_000, animated: false }).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
  let out: { data: Buffer; info: OutputInfo } | null = null;
  for (const quality of [88, 78, 68, 55]) {
    out = await base.clone().webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
    if (out.data.length <= TARGET_BYTES) break;
  }
  return { data: out!.data, width: out!.info.width, height: out!.info.height, bytes: out!.data.length };
}
