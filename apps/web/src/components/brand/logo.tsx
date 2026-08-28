import { cn } from "@/lib/utils";

const WORDMARK_SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl md:text-4xl",
  xl: "text-5xl md:text-6xl",
} as const;

const TILE_SIZES = {
  sm: "size-[20px] text-[11px]",
  md: "size-[26px] text-[14px]",
  lg: "size-[34px] text-[18px]",
  xl: "size-[44px] text-[22px]",
} as const;

type LogoSize = keyof typeof WORDMARK_SIZES;

/**
 * FreeOps wordmark — "Aero" design system (README "Assets"): lowercase
 * `freeOps` wordmark in Geist 600, paired with a 26px rounded-9 accent tile
 * carrying an "f" (Aero has no separate icon mark otherwise — this tile IS
 * the mark). Replaces Ledger Quiet's wordmark-only direction (option "5i");
 * unlike that version this is ink-on-accent for the tile, ink for the
 * wordmark text — never accent-colored text, matching README rule 3
 * ("accent carries… ink anchors" — text stays ink even next to an accent
 * chip).
 *
 * Renders a plain inline element — wrap with `<Link>` where the wordmark
 * should be a home link (nav headers, auth pages), or leave bare where it's
 * static (e.g. inside a card). For icon-only contexts (favicon) see
 * `apps/web/src/app/icon.svg`.
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[9px] bg-accent font-sans font-semibold text-white",
          TILE_SIZES[size]
        )}
      >
        f
      </span>
      <span
        className={cn(
          "font-sans font-semibold tracking-[-0.02em] text-ink",
          WORDMARK_SIZES[size]
        )}
      >
        freeOps
      </span>
    </span>
  );
}
