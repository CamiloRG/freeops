import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="font-serif text-xl font-semibold">
          FreeOps
        </Link>
        <nav aria-label="Marketing" className="hidden items-center gap-8 md:flex">
          <a
            href="#pillars"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            What it does
          </a>
          <a
            href="#compliance"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Compliance
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
