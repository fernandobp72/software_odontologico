import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Los enlaces llevan un token aleatorio; en la base solo se guarda su hash.
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const password = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(100, "La contraseña es demasiado larga")
  .refine((p) => !/^\d+$/.test(p), "No uses solo números")
  .refine((p) => !/^(.)\1+$/.test(p), "No uses un solo carácter repetido");

export const TERMS_VERSION = "2026-10-borrador";
