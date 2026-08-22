import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export default function MarketingHomePage() {
  return (
    <>
      {/* Hero — design_handoff_freeops_ledger_quiet "Landing · hero", mocked
          precisely: eyebrow / display-xl headline (max 520px) / body (max
          420px) / action row, paired with a right aside that must not
          stretch (`align-self: start`). */}
      <section className="mx-auto max-w-[1280px] px-[22px] pt-[56px] pb-[60px] md:px-[44px]">
        <div className="grid grid-cols-1 gap-[40px] md:grid-cols-[1fr_300px] md:gap-[56px]">
          <div>
            <p className="font-mono text-label-mono tracking-[0.08em] text-accent uppercase">
              Para freelancers en Colombia
            </p>
            <h1 className="mt-[22px] max-w-measure text-display-xl text-ink">
              El respaldo administrativo de un empleador. Sin el empleador.
            </h1>
            <p className="mt-[20px] max-w-[420px] text-body text-ink-soft">
              Cuentas de cobro, PILA y seguimiento de clientes en un solo
              lugar — para que dejen de ser una carrera cada fin de mes.
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button size="default" asChild>
                <Link href="/sign-up">Empezar gratis</Link>
              </Button>
              <Button variant="outline" asChild>
                <a href="#pillars">Ver cómo funciona</a>
              </Button>
            </div>
          </div>

          <div className="self-start pt-2">
            <p className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
              Se encarga de
            </p>
            <div className="mt-[20px] flex flex-col gap-[16px]">
              {SE_ENCARGA_DE.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 text-body-sm text-ink"
                >
                  <span>{row.label}</span>
                  <span
                    className={`font-mono text-[11px] ${row.marker === "auto" ? "text-accent" : "text-ink-muted"}`}
                  >
                    {row.marker}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pillars — reskinned from the old feature-card grid onto the
          reference file's own "00 PRINCIPIOS" / "01 COLOR" numbered-section
          layout (140px mono marker column + content), since the handoff
          doesn't mock this section directly but establishes this exact
          pattern for typographic (non-hero) sections. Content/copy
          structure unchanged from the prior build, translated only. */}
      <section id="pillars" className="mx-auto max-w-[1280px] px-[22px] py-[56px] md:px-[44px] md:py-[64px]">
        <div className="max-w-measure">
          <h2 className="text-display text-ink">
            Todo lo disperso se vuelve un solo lugar conectado
          </h2>
          <p className="mt-4 text-body text-ink-soft">
            Se acabó hacer malabares con documentos, hojas de cálculo y una
            lista mental de quién te debe plata. freeops cubre los tres
            frentes de manejar un negocio freelance en Colombia.
          </p>
        </div>

        <div className="mt-[56px] flex flex-col gap-[56px]">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.n}
              className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr] md:gap-0"
            >
              <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                {pillar.n}
              </div>
              <div>
                <h3 className="text-h3 text-ink">{pillar.title}</h3>
                <p className="mt-2 max-w-measure text-body-sm text-ink-soft">
                  {pillar.description}
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {pillar.features.map((feature) => (
                    <li key={feature} className="text-body-sm text-ink">
                      <span className="mr-2 text-ink-faint">—</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance — left-aligned typographic section, no centered prose
          block (rule 1). Copy carried over verbatim/translated, no new
          marketing claims added. */}
      <section id="compliance" className="bg-surface-sunken">
        <div className="mx-auto max-w-[1280px] px-[22px] py-[56px] md:px-[44px] md:py-[64px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr] md:gap-0">
            <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
              04
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
          </div>
        </div>
      </section>

      {/* Testimonials — README "Carrusel / testimonios": no cards, quotes
          at flex 0 0 240px separated by 40px gap, mono attribution, 18×2px
          indicator bars. New section this stage (none existed before) using
          the handoff's own sample quotes, which the README explicitly marks
          as real, usable-as-is copy. */}
      <section className="mx-auto max-w-[1280px] px-[22px] py-[56px] md:px-[44px] md:py-[64px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr] md:gap-0">
          <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
            05
          </div>
          <div>
            <div className="flex flex-wrap items-start gap-[40px]">
              {QUOTES.map((quote) => (
                <div key={quote.author} className="box-border flex-none basis-[240px]">
                  <p className="text-body-sm text-ink">{quote.text}</p>
                  <p className="mt-3 font-mono text-[11px] text-ink-muted">
                    {quote.author}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-1.5">
              {QUOTES.map((quote, i) => (
                <span
                  key={quote.author}
                  className={`h-0.5 w-[18px] ${i === 0 ? "bg-accent" : "bg-line"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA — left-aligned, ink primary button, copy unchanged
          from the prior build's intent, translated. */}
      <section className="mx-auto max-w-[1280px] px-[22px] py-[56px] md:px-[44px] md:py-[64px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr] md:gap-0">
          <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
            06
          </div>
          <div className="max-w-measure">
            <h2 className="text-display text-ink">Saca tu admin de tu plato</h2>
            <p className="mt-4 text-body text-ink-soft">
              Configura tu perfil, conecta tu calendario y genera tu primera
              cuenta de cobro en una sola sentada.
            </p>
            <div className="mt-[34px]">
              <Button asChild>
                <Link href="/sign-up">Empezar gratis</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
