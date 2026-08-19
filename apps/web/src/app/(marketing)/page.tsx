import Link from "next/link";
import { Briefcase, CheckCircle2, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PILLARS = [
  {
    icon: User,
    title: "Professional presence",
    description:
      "A complete profile, branding for your invoices and cuentas de cobro, a resume that pulls straight from your project history, and a booking link prospects can use to grab time on your real calendar.",
    features: [
      "Profile, banking & tax info in one place",
      "Logo & branding on every generated document",
      "Resume/CV that imports completed projects",
      "Shareable booking link (Gmail or Outlook)",
    ],
  },
  {
    icon: Briefcase,
    title: "Business tracking",
    description:
      "Every contract, amendment and change order stored against the right project, a kanban board to run the work, and a simple CRM pipeline that turns a closed-won deal into a project automatically.",
    features: [
      "Contracts, amendments & change orders",
      "Customizable per-project kanban board",
      "CRM pipeline for sales opportunities",
      "Closed-won auto-creates the project",
    ],
  },
  {
    icon: Wallet,
    title: "Finance & compliance",
    description:
      "Generate cuentas de cobro and invoices natively, chase overdue payments automatically, calculate what you owe PILA each month, and hand your accountant a package instead of a shoebox.",
    features: [
      "Cuentas de cobro & invoicing",
      "Automated overdue-payment follow-up",
      "Monthly PILA (IBC) calculation",
      "Accountant-ready tax-document vault",
    ],
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center blur-3xl"
        >
          <div className="h-72 w-[36rem] rounded-full bg-primary/20" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-8 md:py-28">
          <p className="mb-4 text-sm font-medium tracking-wide text-primary uppercase">
            For Colombian freelancers
          </p>
          <h1 className="text-balance font-serif text-4xl font-semibold leading-tight md:text-6xl">
            The admin backup a traditional employer would give you —
            minus the employer.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            FreeOps brings your professional presence, business operations,
            and finance & compliance into one connected hub — so cuentas de
            cobro, PILA, and tax season stop being a monthly scramble.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#pillars">See how it works</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="pillars" className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-semibold md:text-4xl">
            Everything scattered becomes one connected hub
          </h2>
          <p className="mt-4 text-muted-foreground">
            No more juggling documents, spreadsheets, and a mental list of
            who owes you money. FreeOps covers the three sides of running a
            freelance business in Colombia.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="font-serif text-xl">
                    {pillar.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="text-sm text-muted-foreground">
                    {pillar.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {pillar.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="compliance" className="bg-card">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8 md:py-24">
          <h2 className="font-serif text-3xl font-semibold md:text-4xl">
            Built for Colombian compliance, not bolted on after
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Cuentas de cobro and PILA contributions aren&apos;t optional —
            and getting them wrong compounds over time through UGPP
            penalties of 35–60% on omitted contributions, plus DIAN audit
            exposure that can surface years later. FreeOps calculates what
            you owe each month from your actual income and guides you to
            your chosen PILA operator to complete payment — no guessing, no
            spreadsheet.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Regulatory parameters are versioned, not hardcoded, so when UGPP
            or DIAN update the rules, FreeOps updates with them — and your
            past records stay correctly reproducible for DIAN&apos;s ~5-year
            audit window.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8 md:py-24">
        <h2 className="font-serif text-3xl font-semibold md:text-4xl">
          Get your admin off your plate
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Set up your profile, connect your calendar, and generate your
          first cuenta de cobro in one sitting.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href="/sign-up">Get started free</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
