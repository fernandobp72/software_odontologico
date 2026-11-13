-- Versión de sesión: al subirla se invalidan las sesiones abiertas del usuario.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
