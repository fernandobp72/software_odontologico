import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Software Odontológico",
    short_name: "Odontología",
    start_url: "/agenda",
    display: "standalone",
    background_color: "#f3f6f3",
    theme_color: "#2a7a4b",
  };
}
