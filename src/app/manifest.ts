import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Software Odontológico",
    short_name: "Odontología",
    start_url: "/agenda",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0d9488",
  };
}
