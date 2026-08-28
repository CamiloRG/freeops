import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page-level H1 + description, with an optional right-aligned action
 * (e.g. "+ Nuevo proyecto", "Exportar PDF") — sits above a screen's cards,
 * per the new nav mocks (every screen shows breadcrumb — now in the
 * persistent `AppHeader` — then this heading block, then content).
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-h2 text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-body-sm text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
