"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_LEAVES } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

/**
 * Real, minimal ⌘K quick-switcher over the app's own known routes (no
 * backend search — nothing to fetch, filtering a static list is enough to
 * make the header's "⌘K" hint honest rather than decorative-only).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_LEAVES;
    return NAV_LEAVES.filter((leaf) => leaf.label.toLowerCase().includes(q));
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-64 items-center gap-2 rounded-pill border border-line bg-surface-sunken px-4 py-[9px] text-left text-[13px] text-ink-muted transition-colors duration-fast ease-out hover:border-line hover:bg-line-soft lg:w-80"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Buscar proyectos, deals…</span>
        <kbd className="shrink-0 rounded-[6px] border border-line bg-surface px-[6px] py-[1px] font-mono text-[10px] text-ink-muted">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] max-w-lg translate-y-0 gap-0 p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en freeOps…"
            className="w-full border-b border-line px-5 py-4 text-body text-ink outline-none placeholder:text-ink-muted"
          />
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-body-sm text-ink-muted">Sin resultados.</div>
            ) : (
              results.map((leaf) => (
                <button
                  key={leaf.href}
                  type="button"
                  onClick={() => go(leaf.href)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[12px] px-3 py-[10px] text-left text-body-sm text-ink outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken"
                  )}
                >
                  <span>{leaf.label}</span>
                  <span className="font-mono text-[11px] text-ink-muted">{leaf.href}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
