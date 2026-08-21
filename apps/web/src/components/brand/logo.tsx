import { cn } from "@/lib/utils";

const LOGO_SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl md:text-4xl",
  xl: "text-5xl md:text-6xl",
} as const;

type LogoSize = keyof typeof LOGO_SIZES;

/**
 * FreeOps wordmark — Design System & Logo Options.dc.html, option "5i"
 * ("no mark — confident wordmark alone"). Space Grotesk 700, lowercase,
 * tight tracking, ink-colored (not primary/violet — the mockup's header
 * wordmark reads in the foreground/ink token). Deliberately text-only:
 * there is no icon/mark in this direction. For icon-only contexts (e.g.
 * the favicon) see `apps/web/src/app/icon.svg` instead.
 *
 * Renders a plain inline element — wrap with `<Link>` where the wordmark
 * should be a home link (nav headers, auth pages), or leave bare where it's
 * static (e.g. inside a card).
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-brand font-bold tracking-[-0.02em] text-foreground",
        LOGO_SIZES[size],
        className
      )}
    >
      freeops
    </span>
  );
}
