import { Logo } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-[22px] py-[44px] md:px-[44px]">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <Logo size="sm" />
          <p className="max-w-measure text-caption text-ink-soft md:text-right">
            Hecho para freelancers en Colombia. No sustituye el consejo de tu
            contador o un contador público autorizado.
          </p>
        </div>
        <p className="mt-6 font-mono text-[11px] text-ink-muted">
          © {new Date().getFullYear()} freeops. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
