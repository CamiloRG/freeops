import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

// "Ledger Quiet" design system (v1.0) — labels, breadcrumbs, metadata and
// numeric values (money, phone, timestamps) are set in IBM Plex Mono
// everywhere, per the handoff's rule 4 ("every label is mono, uppercase").
// Loaded the same way as the other two families below; see globals.css's
// `--font-mono` wiring in the `@theme inline` block.
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
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
      className={`${publicSans.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
