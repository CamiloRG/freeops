"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Aero" scroll-entrance reveal (README rule 6 + "Interactions & behavior"
 * → "Scroll entrance"): must **fail open** — reveal anything already in the
 * viewport on mount, re-check on scroll and resize, and force-reveal
 * everything after a ~1.6s timeout no matter what, so content can never get
 * stuck invisible if the observer never fires. Actual animation (16px rise
 * + fade, 420ms) is CSS-driven via `[data-reveal="in"]` in `globals.css`;
 * `prefers-reduced-motion` is handled there too.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setRevealed(true);
    };

    const isInViewport = () => {
      const rect = node.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };

    if (isInViewport()) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { threshold: 0.1 }
    );
    observer.observe(node);

    const onScrollOrResize = () => {
      if (isInViewport()) reveal();
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    const timeout = window.setTimeout(reveal, 1600);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.clearTimeout(timeout);
    };
  }, []);

  return { ref, revealed };
}
