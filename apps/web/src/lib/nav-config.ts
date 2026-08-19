import type { LucideIcon } from "lucide-react";
import { Briefcase, User, Wallet } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

// The three top-level sections named explicitly in app_spec.md — Personal,
// Business, Finance — shared by the desktop sidebar and the mobile bottom
// tab bar so the two navs can never drift out of sync.
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Personal",
    href: "/personal",
    icon: User,
    description: "Profile, branding, resume, scheduling",
  },
  {
    label: "Business",
    href: "/business",
    icon: Briefcase,
    description: "Projects, contracts, kanban, CRM",
  },
  {
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    description: "Cuentas de cobro, payments, PILA, tax vault",
  },
];
