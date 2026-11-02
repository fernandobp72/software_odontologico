/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Solo desarrollo: permite abrir el servidor local por 127.0.0.1 (el navegador integrado a veces no abre localhost).
  allowedDevOrigins: ["127.0.0.1"],
  // Cabeceras de seguridad: sin marcos ajenos, sin adivinar tipos, HTTPS siempre y permisos de sensores limitados (micrófono propio para el dictado).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
