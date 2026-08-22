/**
 * Shared tab config for the Personal module's 5 screens. Route hrefs stay
 * English (a route rename is out of scope for this visual restyle) — only
 * the visible tab label and the mono breadcrumb text are Spanish, per the
 * handoff's mocked Profile/Banking screens (README "Screens" → "3." / "4.").
 */
export const PERSONAL_TABS: { href: string; label: string; breadcrumb: string }[] = [
  { href: "/personal/profile", label: "Perfil", breadcrumb: "PERSONAL / PERFIL" },
  { href: "/personal/banking", label: "Banca", breadcrumb: "PERSONAL / BANCA" },
  { href: "/personal/tax", label: "Tributario", breadcrumb: "PERSONAL / TRIBUTARIO" },
  { href: "/personal/branding", label: "Marca", breadcrumb: "PERSONAL / MARCA" },
  { href: "/personal/resume", label: "Hoja de vida", breadcrumb: "PERSONAL / HOJA DE VIDA" },
];
