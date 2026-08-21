import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/**
 * "Ledger Quiet" site header (README "Navigation" → "Site header" + the
 * mocked Landing/hero screen): wordmark left, links center, auth right
 * ("Iniciar sesión" text + ink "Empezar" button), one `1px --line` rule
 * underneath — the only structural hairline besides the app nav-rail edge.
 * Full-bleed 22px/44px padding per the mock, not a centered container (rule
 * 1: "nothing is centered" — width-capped only to avoid an unreadably wide
 * row on very large monitors, matching the design-system reference file's
 * own 1280px outer wrapper).
 *
 * Kept the existing page's two anchor links (translated) rather than adding
 * the mock's third "Precios" link — there is no pricing section in this
 * codebase to link to, and the brief is to reskin the existing information
 * architecture, not invent new pages/sections.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-[22px] py-[22px] md:px-[44px]">
        <Link href="/">
          <Logo size="md" />
        </Link>
        <nav aria-label="Marketing" className="hidden items-center gap-[26px] md:flex">
          <a
            href="#pillars"
            className="font-sans text-[12.5px] text-ink-soft transition-colors duration-fast ease-out hover:text-ink"
          >
            Qué hace
          </a>
          <a
            href="#compliance"
            className="font-sans text-[12.5px] text-ink-soft transition-colors duration-fast ease-out hover:text-ink"
          >
            Compliance
          </a>
        </nav>
        <div className="flex items-center gap-[18px]">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Empezar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
