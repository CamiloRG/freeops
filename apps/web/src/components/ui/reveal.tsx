"use client";

import type { ElementType, ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/**
 * Thin wrapper applying the shared scroll-entrance reveal (see
 * `use-reveal.ts` / `globals.css`'s `[data-reveal]` keyframe) to marketing
 * sections. `as` lets callers pick the right element (e.g. `section`).
 */
export function Reveal({
  as: Component = "div",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <Component
      ref={ref}
      data-reveal={revealed ? "in" : undefined}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}
