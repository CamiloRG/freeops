import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/**
 * "Aero" site header (README "Navigation" → "Site header" + screen 1,
 * "Marketing"): "logo + links left, 'Sign in' + accent pill right.
 * Transparent over the dark hero." Absolutely positioned (not sticky) so
 * it overlays the hero exactly once and scrolls away with it — the hero is
 * the only section it's designed to sit over. Carries its own
 * `data-theme="dark"` (independent of the page below it) since it's always
 * meant to read as light-on-dark, matching the hero it overlays; if a
 * future marketing page has no dark hero beneath this header, it will need
 * its own treatment — flagged here rather than silently assumed away.
 *
 * Kept the existing page's two anchor links (translated) rather than the
 * mock's third "Precios" link — there is no pricing section in this
 * codebase to link to (see the homepage's own note on why).
 */
export function MarketingHeader() {
  return (
    <header
      data-theme="dark"
      className="absolute inset-x-0 top-0 z-40"
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-[22px] py-[22px] md:px-[44px]">
        <Link href="/">
          <Logo size="md" />
        </Link>
        <nav aria-label="Marketing" className="hidden items-center gap-[26px] md:flex">
          <a
            href="#pillars"
            className="font-sans text-[13px] text-ink-soft transition-colors duration-fast ease-out hover:text-ink"
          >
            Qué hace
          </a>
          <a
            href="#compliance"
            className="font-sans text-[13px] text-ink-soft transition-colors duration-fast ease-out hover:text-ink"
          >
            Compliance
          </a>
        </nav>
        <div className="flex items-center gap-3">
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
