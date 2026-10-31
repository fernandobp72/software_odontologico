/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Solo desarrollo: permite abrir el servidor local por 127.0.0.1 (el navegador integrado a veces no abre localhost).
  allowedDevOrigins: ["127.0.0.1"],
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
