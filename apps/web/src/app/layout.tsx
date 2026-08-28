import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// "Aero" design system (v2.0) — two families, no exceptions: Geist for
// everything, Geist Mono for labels/IDs/timestamps/numeric columns (README
// rule 5). Replaces Ledger Quiet's Public Sans (body) + Space Grotesk
// (wordmark-only) + IBM Plex Mono (labels) — Aero's own wordmark is set in
// Geist 600 too (see `components/brand/logo.tsx`), so there's no longer a
// separate brand-only face.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FreeOps",
    template: "%s · FreeOps",
  },
  description:
    "FreeOps is the admin and finance hub for Colombian freelancers — profile, contracts, cuentas de cobro, PILA, and an accountant-ready tax vault, all in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
