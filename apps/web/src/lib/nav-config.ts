import type { LucideIcon } from "lucide-react";
import { Briefcase, Home, Settings, User, Wallet } from "lucide-react";

export type NavLeaf = {
  label: string;
  href: string;
  /** Shown in the top header's breadcrumb once this leaf is the active route. */
  breadcrumb: string;
};

export type NavSection = {
  label: string;
  icon: LucideIcon;
  /** Present on a leaf-only item (Principal, Finanzas) — no expand/collapse. */
  href?: string;
  breadcrumb?: string;
  children?: NavLeaf[];
};

/**
 * Single source of truth for the app-wide sidebar tree AND the top
 * header's route→breadcrumb lookup — mirrors the new nav mocks (icon
 * sidebar with collapsible Personal/Negocios/Configuraciones sections,
 * flat Principal/Finanzas rows). Both `AppSidebar` and `AppHeader` read
 * this so the two can never drift out of sync, same reasoning as the old
 * `NAV_ITEMS`/`MobileTabBar` pairing this replaces.
 *
 * "Perfil" is kept as Personal's first child even though none of the
 * supplied mocks' sidebar screenshots show it (they consistently list only
 * Info. Bancaria / Info. Tributaria / Marca Personal / Hoja de vida) —
 * dropping it would remove the only way to reach a real, working screen
 * from the UI. Flagged rather than silently resolved either way.
 */
export const NAV_TREE: NavSection[] = [
  {
    label: "Principal",
    icon: Home,
    href: "/principal",
    breadcrumb: "Principal",
  },
  {
    label: "Personal",
    icon: User,
    children: [
      { label: "Perfil", href: "/personal/profile", breadcrumb: "Personal / Perfil" },
      { label: "Info. Bancaria", href: "/personal/banking", breadcrumb: "Personal / Info. Bancaria" },
      { label: "Info. Tributaria", href: "/personal/tax", breadcrumb: "Personal / Info. Tributaria" },
      { label: "Marca Personal", href: "/personal/branding", breadcrumb: "Personal / Marca Personal" },
      { label: "Hoja de vida", href: "/personal/resume", breadcrumb: "Personal / Hoja de vida" },
    ],
  },
  {
    label: "Negocios",
    icon: Briefcase,
    children: [
      { label: "Pipeline", href: "/business/crm", breadcrumb: "Negocios / Pipeline" },
      { label: "Proyectos", href: "/business/projects", breadcrumb: "Negocios / Proyectos" },
    ],
  },
  {
    label: "Finanzas",
    icon: Wallet,
    children: [
      { label: "Cuentas de cobro", href: "/finance/cuentas-de-cobro", breadcrumb: "Finanzas / Cuentas de cobro" },
      { label: "Facturas", href: "/finance/invoices", breadcrumb: "Finanzas / Facturas" },
    ],
  },
  {
    label: "Configuraciones",
    icon: Settings,
    children: [
      { label: "Correo", href: "/settings/mail", breadcrumb: "Configuraciones / Correo" },
      { label: "Calendario", href: "/settings/calendar", breadcrumb: "Configuraciones / Calendario" },
      { label: "BYOK", href: "/settings/byok", breadcrumb: "Configuraciones / BYOK" },
      { label: "Temas", href: "/settings/theme", breadcrumb: "Configuraciones / Temas" },
    ],
  },
];

/** Flat list of every leaf route, for breadcrumb lookup and the mobile tab bar. */
export const NAV_LEAVES: NavLeaf[] = NAV_TREE.flatMap((section) =>
  section.children ? section.children : [{ label: section.label, href: section.href!, breadcrumb: section.breadcrumb! }]
);

/** The 3 top-level areas the old mobile tab bar used — kept for that narrow surface only. */
export const MOBILE_NAV_ITEMS = [
  { label: "Personal", href: "/personal", icon: User },
  { label: "Negocios", href: "/business", icon: Briefcase },
  { label: "Finanzas", href: "/finance", icon: Wallet },
];
