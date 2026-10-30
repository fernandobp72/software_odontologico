export const IMAGE_KINDS = {
  PERIAPICAL: "Radiografía periapical",
  BITEWING: "Radiografía coronal (aleta de mordida)",
  PANORAMIC: "Radiografía panorámica",
  OCCLUSAL: "Radiografía oclusal",
  CEPH: "Radiografía cefalométrica",
  CBCT: "Tomografía (CBCT)",
  PHOTO_INTRA: "Fotografía intraoral",
  PHOTO_EXTRA: "Fotografía extraoral",
  DOC: "Documento o informe",
  OTHER: "Otro",
} as const;
export type ImageKind = keyof typeof IMAGE_KINDS;
export const MAX_BYTES = 10 * 1024 * 1024;

// Tipo real del archivo según sus primeros bytes (no se confía en el tipo que declara el navegador).
export function sniff(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  const h = (i: number) => buf[i];
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return "image/jpeg";
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return "image/png";
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46) return "application/pdf";
  if (h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 && h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50) return "image/webp";
  return null;
}
