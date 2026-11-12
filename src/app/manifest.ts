import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Software Odontológico",
    short_name: "Odontología",
    start_url: "/agenda",
    display: "standalone",
    background_color: "#f3f6f3",
    theme_color: "#2a7a4b",
    icons: [
      { src: "/api/icono/generico/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/icono/generico/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/icono/generico/512?m=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
