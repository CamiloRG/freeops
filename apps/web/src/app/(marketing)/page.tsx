import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";

const PROOF_STATS = [
  { value: "3", label: "módulos en un solo lugar" },
  { value: "100%", label: "cálculo PILA automático" },
  { value: "0", label: "hojas de cálculo necesarias" },
];

const SE_ENCARGA_DE = [
  { label: "Cuentas de cobro", marker: "auto" as const },
  { label: "Cálculo PILA", marker: "auto" as const },
  { label: "Recordatorios de mora", marker: "auto" as const },
  { label: "Pipeline de clientes", marker: "manual" as const },
];

const PILLARS = [
  {
    n: "01",
    title: "Presencia profesional",
    description:
      "Un perfil completo, marca para tus facturas y cuentas de cobro, una hoja de vida que se arma sola desde tu historial de proyectos, y un enlace para agendar que tus prospectos usan directo en tu calendario real.",
    features: [
      "Perfil, banca y datos tributarios en un solo lugar",
      "Logo y marca en cada documento generado",
      "Hoja de vida que importa tus proyectos terminados",
      "Enlace de agenda compartible (Gmail u Outlook)",
    ],
  },
  {
    n: "02",
    title: "Seguimiento del negocio",
    description:
      "Cada contrato, otrosí y cambio de alcance guardado contra el proyecto correcto, un kanban por proyecto para llevar el trabajo, y un pipeline de CRM simple que convierte un negocio cerrado en un proyecto automáticamente.",
    features: [
      "Contratos, otrosíes y cambios de alcance",
      "Kanban personalizable por proyecto",
      "Pipeline de CRM para oportunidades",
      "Cerrado-ganado crea el proyecto automáticamente",
    ],
  },
  {
    n: "03",
    title: "Finanzas y compliance",
    description:
      "Genera cuentas de cobro y facturas de forma nativa, persigue pagos en mora automáticamente, calcula lo que debes de PILA cada mes, y entrégale a tu contador un paquete en vez de una caja de recibos.",
    features: [
      "Cuentas de cobro y facturación",
      "Seguimiento automático de pagos en mora",
      "Cálculo mensual de PILA (IBC)",
      "Bóveda de documentos tributarios lista para tu contador",
    ],
  },
];

const QUOTES = [
  { text: "Dejé de perseguir facturas. Ahora las manda solas.", author: "Ana · diseñadora" },
  { text: "Mi PILA se calcula sola cada mes.", author: "Julián · desarrollador" },
  { text: "Todo mi pipeline en un solo lugar.", author: "Marcela · consultora" },
];

const PRODUCT_FRAME_ROWS = [
  { client: "Estudio Marea", id: "CC-0142", status: "Pagada" as const, amount: "$3.200.000" },
  { client: "Nortec SAS", id: "CC-0141", status: "Pendiente" as const, amount: "$1.850.000" },
  { client: "Ana Restrepo", id: "CC-0140", status: "Vencida" as const, amount: "$960.000" },
];

const STATUS_STYLE = {
  Pagada: "bg-positive-tint text-positive-ink",
  Pendiente: "bg-attention-tint text-attention-ink",
  Vencida: "bg-critical-tint text-critical-ink",
} as const;

export default function MarketingHomePage() {
  return (
    <>
      {/* Hero — Aero screen 1 ("Marketing — dark hero, light body"): eyebrow
          pill with pulsing dot / display-xl headline / body-lg subcopy (max
          460) / pill CTA pair / three inline proof stats. Right: a static
          illustrative "product frame" built from the app's own Card/Badge
          components (not a live screenshot) — radius-20 top corners only,
          flush to the hero's bottom edge, dark-floating shadow. A fixed
          radial accent glow sits top-right at 28% opacity, per spec the one
          allowed decorative gradient. */}
      <section data-theme="dark" className="relative overflow-hidden bg-bg pt-[128px] pb-[64px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-120px] right-[-120px] size-[520px] rounded-full opacity-[0.28]"
          style={{
            background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-[48px] px-[22px] md:grid-cols-2 md:px-[44px]">
          <Reveal as="div" className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-[8px] rounded-pill bg-accent-tint px-[13px] py-[6px] font-mono text-label-mono tracking-[0.14em] text-accent-on-dark uppercase">
              <span
                aria-hidden="true"
                className="size-[6px] rounded-full bg-accent-on-dark animate-[ai-processing-pulse_1.6s_ease-in-out_infinite]"
              />
              Para freelancers en Colombia
            </div>
            <h1 className="mt-[22px] max-w-measure text-display-xl text-ink">
              El respaldo administrativo de un empleador. Sin el empleador.
            </h1>
            <p className="mt-[20px] max-w-[460px] text-body-lg text-ink-soft">
              Cuentas de cobro, PILA y seguimiento de clientes en un solo
              lugar — para que dejen de ser una carrera cada fin de mes.
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/sign-up">Empezar gratis</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <a href="#pillars">Ver cómo funciona</a>
              </Button>
            </div>
            <div className="mt-[44px] flex flex-wrap gap-[32px]">
              {PROOF_STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-[26px] leading-none font-semibold text-ink">
                    {stat.value}
                  </div>
                  <div className="mt-[6px] text-[12px] text-ink-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal as="div" className="relative self-end">
            <div className="overflow-hidden rounded-t-card rounded-b-none border border-b-0 border-line bg-surface shadow-dark-floating">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="text-h3 text-ink">Cuentas de cobro</span>
                <span className="font-mono text-data-mono text-ink-muted uppercase">
                  agosto 2026
                </span>
              </div>
              <div className="flex flex-col">
                {PRODUCT_FRAME_ROWS.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-[14px] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-body-sm font-medium text-ink">
                        {row.client}
                      </div>
                      <div className="font-mono text-data-mono text-ink-muted">{row.id}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-pill px-[10px] py-[4px] text-[11px] font-medium ${STATUS_STYLE[row.status]}`}
                    >
                      {row.status}
                    </span>
                    <span className="shrink-0 font-mono text-data-mono text-ink">
                      {row.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* "Se encarga de" — dark band right after the hero, in place of a
          client-logo strip (no real customers to show yet — this app is
          pre-launch, and Aero's own logo-band device is specifically for
          social proof, which would be fabricated here). Reuses the exact
          real automation list the previous build already established. */}
      <section data-theme="dark" className="bg-surface-sunken">
        <Reveal as="div" className="mx-auto max-w-[1280px] px-[22px] py-[32px] md:px-[44px]">
          <div className="flex flex-wrap items-center gap-x-[40px] gap-y-[14px]">
            {SE_ENCARGA_DE.map((row) => (
              <div key={row.label} className="flex items-center gap-2 text-body-sm text-ink">
                <span>{row.label}</span>
                <span
                  className={`font-mono text-[11px] uppercase ${row.marker === "auto" ? "text-accent-on-dark" : "text-ink-muted"}`}
                >
                  {row.marker}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Value band — light, three cards with numbered accent-tint tiles
          (Aero screen 1's "light value band"). Content unchanged from the
          prior build (pillars), only the container is now a real Card. */}
      <section id="pillars" className="bg-bg">
        <div className="mx-auto max-w-[1280px] px-[22px] py-[64px] md:px-[44px]">
          <Reveal as="div" className="max-w-measure">
            <h2 className="text-display text-ink">
              Todo lo disperso se vuelve un solo lugar conectado
            </h2>
            <p className="mt-4 text-body text-ink-soft">
              Se acabó hacer malabares con documentos, hojas de cálculo y una
              lista mental de quién te debe plata. freeops cubre los tres
              frentes de manejar un negocio freelance en Colombia.
            </p>
          </Reveal>

          <div className="mt-[40px] grid grid-cols-1 gap-5 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <Reveal key={pillar.n} as="div">
                <Card className="h-full">
                  <div className="flex size-9 items-center justify-center rounded-tile bg-accent-tint font-mono text-[12px] font-medium text-accent-press">
                    {pillar.n}
                  </div>
                  <h3 className="mt-4 text-h3 text-ink">{pillar.title}</h3>
                  <p className="mt-2 text-body-sm text-ink-soft">{pillar.description}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {pillar.features.map((feature) => (
                      <li key={feature} className="text-body-sm text-ink">
                        <span className="mr-2 text-ink-muted">—</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance — tinted band, alternating the page's rhythm per rule
          "so the page has rhythm." Copy carried over verbatim. */}
      <section id="compliance" className="bg-surface-sunken">
        <div className="mx-auto max-w-[1280px] px-[22px] py-[64px] md:px-[44px]">
          <Reveal as="div" className="grid grid-cols-1 gap-8 md:grid-cols-[auto_1fr]">
            <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
              Compliance
            </div>
            <div className="max-w-measure">
              <h2 className="text-display text-ink">
                Hecho para el compliance colombiano, no pegado después
              </h2>
              <p className="mt-4 text-body text-ink-soft">
                Las cuentas de cobro y los aportes a PILA no son opcionales —
                y hacerlos mal se acumula con el tiempo: sanciones de la UGPP
                del 35–60% sobre lo omitido, más la exposición a auditorías
                de la DIAN que pueden aparecer años después. freeops calcula
                lo que debes cada mes a partir de tus ingresos reales y te
                lleva al operador de PILA que elijas para completar el pago —
                sin adivinar, sin hoja de cálculo.
              </p>
              <p className="mt-4 text-body-sm text-ink-soft">
                Los parámetros regulatorios están versionados, no quemados en
                el código, así que cuando la UGPP o la DIAN actualicen las
                reglas, freeops se actualiza con ellas — y tus registros
                pasados siguen siendo reproducibles correctamente dentro de
                la ventana de auditoría de ~5 años de la DIAN.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Testimonials — real sample quotes carried over verbatim. */}
      <section className="bg-bg">
        <Reveal as="div" className="mx-auto max-w-[1280px] px-[22px] py-[64px] md:px-[44px]">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {QUOTES.map((quote) => (
              <Card key={quote.author} size="sm">
                <p className="text-body-sm text-ink">{quote.text}</p>
                <p className="mt-3 font-mono text-data-mono text-ink-muted">{quote.author}</p>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA — dark band, mirrors the hero's theme so the page
          bookends itself. */}
      <section data-theme="dark" className="bg-surface-sunken">
        <Reveal as="div" className="mx-auto max-w-[1280px] px-[22px] py-[64px] md:px-[44px]">
          <div className="max-w-measure">
            <h2 className="text-display text-ink">Saca tu admin de tu plato</h2>
            <p className="mt-4 text-body text-ink-soft">
              Configura tu perfil, conecta tu calendario y genera tu primera
              cuenta de cobro en una sola sentada.
            </p>
            <div className="mt-[34px]">
              <Button size="lg" asChild>
                <Link href="/sign-up">Empezar gratis</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
