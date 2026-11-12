import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Software Odontológico",
  description: "Gestión clínica odontológica",
  // Ícono genérico (diente sobre verde) para las páginas fuera de la sesión: ingreso, registro, firma, recibos. Dentro de la
  // app lo reemplaza el ícono del consultorio (ver (app)/layout.tsx).
  icons: {
    icon: [
      { url: "/api/icono/generico/32", sizes: "32x32", type: "image/png" },
      { url: "/api/icono/generico/192", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/api/icono/generico/180", sizes: "180x180", type: "image/png" }],
  },
};

// viewport-fit=cover permite usar las áreas seguras de iPhone (muesca y barra inferior) para que la barra de navegación no quede tapada.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
