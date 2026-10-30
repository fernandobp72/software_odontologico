# Despliegue en Coolify

1. En Coolify: **New Resource → Database → PostgreSQL**. Copia la *Internal URL* (postgres://…).
2. **New Resource → Application → repositorio Git**, build pack **Dockerfile**, puerto **3000**.
3. Variables de entorno de la aplicación (runtime):
   - `DATABASE_URL` = la Internal URL del paso 1
   - `SESSION_SECRET` = `openssl rand -base64 32`
4. Dominio: asigna uno con HTTPS (Coolify genera el certificado). La sesión usa cookie `secure` en producción, así que el sitio debe servirse por HTTPS.
5. Deploy. Las migraciones se aplican solas al arrancar.
6. Primer usuario (una sola vez), desde la terminal de la app en Coolify:
   `SEED_EMAIL=tu@correo.com SEED_NAME="Tu Nombre" SEED_PASSWORD='<contraseña>' npx prisma db seed`
7. En el celular abre el dominio y usa "Agregar a pantalla de inicio" para instalarla como app.
