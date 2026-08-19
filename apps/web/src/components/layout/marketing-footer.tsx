export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <span className="font-serif text-lg font-semibold">FreeOps</span>
          <p className="text-center text-sm text-muted-foreground md:text-right">
            Built for Colombian freelancers. Not a substitute for advice from
            your accountant or a licensed contador.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground md:text-left">
          © {new Date().getFullYear()} FreeOps. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
