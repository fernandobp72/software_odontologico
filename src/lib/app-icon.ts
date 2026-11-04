import "server-only";
import sharp from "sharp";

export const DEFAULT_THEME = "#2a7a4b";
export const hexOk = (v: string | null | undefined): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

export const ICON_SIZES = [180, 192, 512] as const;

// Diente blanco para los consultorios que aún no suben logo (dibujado, sin texto: no depende de las fuentes del servidor).
const TOOTH = (size: number, bg: string, scale: number) => {
  const s = size * scale;
  const o = (size - s) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>` +
      `<g transform="translate(${o} ${o}) scale(${s / 100})"><path fill="#fff" d="M50 18C44 14 36 12 29 14C19 17 14 26 15 37C16 46 20 52 22 62C24 74 26 88 33 88C40 88 41 74 44 66C46 61 48 59 50 59C52 59 54 61 56 66C59 74 60 88 67 88C74 88 76 74 78 62C80 52 84 46 85 37C86 26 81 17 71 14C64 12 56 14 50 18Z"/></g></svg>`,
  );
};

// Ícono cuadrado de la app: el logo del consultorio centrado sobre un color, con margen. "maskable" deja más margen para que
// Android pueda recortarlo en círculo o gota sin comerse el logo.
export async function renderIcon(c: { logo: Uint8Array | Buffer | null; iconColor: string | null }, size: number, maskable: boolean) {
  const bg = hexOk(c.iconColor) ? c.iconColor : c.logo ? "#ffffff" : DEFAULT_THEME;
  if (!c.logo) return sharp(TOOTH(size, bg, maskable ? 0.56 : 0.72)).png().toBuffer();
  const inner = Math.round(size * (maskable ? 0.56 : 0.72));
  const logo = await sharp(Buffer.from(c.logo)).resize(inner, inner, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
