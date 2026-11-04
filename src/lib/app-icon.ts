import "server-only";
import sharp from "sharp";

export const DEFAULT_THEME = "#2a7a4b";
export const hexOk = (v: string | null | undefined): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

export const ICON_SIZES = [180, 192, 512] as const;

// Versión del ícono para que el navegador lo vuelva a pedir cuando cambia el logo, el ícono propio o el color.
export const iconVersion = (c: { logoUpdatedAt?: Date | null; appIconUpdatedAt?: Date | null; iconColor?: string | null }) =>
  `${c.logoUpdatedAt?.getTime() ?? 0}-${c.appIconUpdatedAt?.getTime() ?? 0}${hexOk(c.iconColor) ? c.iconColor.slice(1) : ""}`;

// Diente blanco para los consultorios que aún no suben logo (dibujado, sin texto: no depende de las fuentes del servidor).
const TOOTH = (size: number, bg: string, scale: number) => {
  const s = size * scale;
  const o = (size - s) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>` +
      `<g transform="translate(${o} ${o}) scale(${s / 100})"><path fill="#fff" d="M50 18C44 14 36 12 29 14C19 17 14 26 15 37C16 46 20 52 22 62C24 74 26 88 33 88C40 88 41 74 44 66C46 61 48 59 50 59C52 59 54 61 56 66C59 74 60 88 67 88C74 88 76 74 78 62C80 52 84 46 85 37C86 26 81 17 71 14C64 12 56 14 50 18Z"/></g></svg>`,
  );
};

type Art = Uint8Array | Buffer | null;

// Color de la esquina de una imagen: sirve de fondo cuando el ícono propio se achica para el recorte de Android.
async function cornerColor(img: Buffer) {
  const { data } = await sharp(img).resize(8, 8, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b, a] = data;
  return a < 250 ? "#ffffff" : `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const onColor = (size: number, bg: string, layer: Buffer) =>
  sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: layer, gravity: "centre" }]).png({ compressionLevel: 9 }).toBuffer();

// Ícono cuadrado de la app. Con ícono propio cuadrado ocupa todo el espacio; con una imagen no cuadrada (o solo el logo) se
// centra con margen sobre un color. "maskable" deja más margen para que Android pueda recortarlo en círculo sin comerse nada.
export async function renderIcon(c: { logo: Art; appIcon?: Art; iconColor: string | null }, size: number, maskable: boolean) {
  const own = c.appIcon ? Buffer.from(c.appIcon) : null;
  const art = own ?? (c.logo ? Buffer.from(c.logo) : null);
  if (!art) return sharp(TOOTH(size, hexOk(c.iconColor) ? c.iconColor : DEFAULT_THEME, maskable ? 0.56 : 0.72)).png().toBuffer();

  const { width = 1, height = 1 } = await sharp(art).metadata();
  const square = own !== null && Math.abs(width / height - 1) < 0.1;
  if (square) {
    const bg = hexOk(c.iconColor) ? c.iconColor : await cornerColor(art);
    const inner = maskable ? Math.round(size * 0.8) : size;
    const layer = await sharp(art).resize(inner, inner, { fit: "cover" }).png().toBuffer();
    return onColor(size, bg, layer);
  }
  const bg = hexOk(c.iconColor) ? c.iconColor : "#ffffff";
  const inner = Math.round(size * (maskable ? 0.56 : 0.72));
  const layer = await sharp(art).resize(inner, inner, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return onColor(size, bg, layer);
}
