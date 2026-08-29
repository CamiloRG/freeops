import { redirect } from "next/navigation";

/**
 * `/finance` itself has no dedicated screen this stage (no combined-
 * dashboard scope yet — see the phase report) — redirects to its first
 * real child, same as every other section whose sidebar entry is a tree
 * rather than a single page.
 */
export default function FinanceIndexPage() {
  redirect("/finance/cuentas-de-cobro");
}
